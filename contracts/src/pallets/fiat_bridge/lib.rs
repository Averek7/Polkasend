//! # pallet_fiat_bridge
//!
//! Fiat settlement bridge for PolkaSend. Coordinates between the on-chain
//! remittance order and the off-chain UPI/IMPS payment execution via
//! authorized NBFC oracle nodes.
//!
//! ## Settlement Flow
//!
//! 1. pallet_remittance sets order status = SettlementTriggered
//! 2. pallet_fiat_bridge emits SettlementRequested event
//! 3. Off-chain oracle node (registered NBFC partner) picks up event
//! 4. Oracle executes UPI push / IMPS via its banking API
//! 5. Oracle calls confirm_settlement with UTR number
//! 6. pallet_remittance marks order Completed
//!
//! ## FATF Travel Rule compliance
//!
//! Each settlement request includes a TravelRulePayload with sender/recipient
//! identifying information as required by FATF Recommendation 16.

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

pub use pallet::*;

/// Travel Rule payload (FATF R.16 compliance)
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct TravelRulePayload {
    /// Originator name (from KYC record)
    pub originator_name:    BoundedVec<u8, ConstU32<100>>,
    /// Originator account reference (hashed)
    pub originator_ref:     [u8; 32],
    /// Beneficiary name
    pub beneficiary_name:   BoundedVec<u8, ConstU32<100>>,
    /// Beneficiary account reference
    pub beneficiary_ref:    BoundedVec<u8, ConstU32<50>>,
    /// Originating institution (PolkaSend Para #3000)
    pub originator_vasp:    BoundedVec<u8, ConstU32<50>>,
    /// Beneficiary institution (NBFC partner code)
    pub beneficiary_vasp:   BoundedVec<u8, ConstU32<50>>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Registered oracle accounts (NBFC partners)
        type OracleOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// Governance can register / deregister oracles
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Registered oracle nodes (NBFC partners)
    #[pallet::storage]
    pub type RegisteredOracles<T: Config> = StorageMap<
        _, Blake2_128Concat, T::AccountId, bool, ValueQuery
    >;

    /// Pending settlement requests awaiting oracle execution
    #[pallet::storage]
    pub type PendingSettlements<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        [u8; 32], // order_id
        (u64, TravelRulePayload, BlockNumberFor<T>), // (amount_paise, travel_rule, requested_at)
        OptionQuery,
    >;

    /// Total settlements processed
    #[pallet::storage]
    pub type TotalSettlements<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Oracle node should execute fiat payment
        SettlementRequested {
            order_id:     [u8; 32],
            amount_paise: u64,
            travel_rule:  TravelRulePayload,
        },
        /// Oracle confirmed fiat delivery
        SettlementConfirmed {
            order_id:   [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
            oracle:     T::AccountId,
        },
        OracleRegistered   { oracle: T::AccountId },
        OracleDeregistered { oracle: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotRegisteredOracle,
        SettlementNotFound,
        AlreadyRegistered,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Governance registers a new NBFC oracle partner
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(5_000_000, 0))]
        pub fn register_oracle(
            origin: OriginFor<T>,
            oracle: T::AccountId,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(!RegisteredOracles::<T>::get(&oracle), Error::<T>::AlreadyRegistered);
            RegisteredOracles::<T>::insert(&oracle, true);
            Self::deposit_event(Event::OracleRegistered { oracle });
            Ok(())
        }

        /// Request fiat settlement (called by pallet_remittance)
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(15_000_000, 0))]
        pub fn request_settlement(
            origin:       OriginFor<T>,
            order_id:     [u8; 32],
            amount_paise: u64,
            travel_rule:  TravelRulePayload,
        ) -> DispatchResult {
            ensure_signed(origin)?; // Called by pallet_remittance sovereign account

            let block = <frame_system::Pallet<T>>::block_number();
            PendingSettlements::<T>::insert(
                order_id,
                (amount_paise, travel_rule.clone(), block),
            );

            Self::deposit_event(Event::SettlementRequested {
                order_id,
                amount_paise,
                travel_rule,
            });
            Ok(())
        }

        /// Registered oracle confirms successful UPI/IMPS delivery
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn confirm_settlement(
            origin:     OriginFor<T>,
            order_id:   [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
        ) -> DispatchResult {
            let oracle = ensure_signed(origin)?;
            ensure!(RegisteredOracles::<T>::get(&oracle), Error::<T>::NotRegisteredOracle);
            ensure!(
                PendingSettlements::<T>::contains_key(order_id),
                Error::<T>::SettlementNotFound
            );

            PendingSettlements::<T>::remove(order_id);
            TotalSettlements::<T>::mutate(|n| *n += 1);

            Self::deposit_event(Event::SettlementConfirmed {
                order_id,
                utr_number,
                oracle,
            });
            Ok(())
        }
    }
}
