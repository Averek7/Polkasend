//! # pallet-fiat-bridge
//!
//! UPI/IMPS off-chain settlement oracle bridge for PolkaSend.
//!
//! This pallet manages a whitelist of authorized oracle accounts
//! (registered NBFCs / AD-I bank partners) that can post UPI payment
//! confirmations on-chain as proof of fiat delivery.
//!
//! ## Flow
//! 1. `pallet_remittance::initiate_remittance` creates an order with DeliveryMode::UpiInstant
//! 2. Off-chain service watches for `SettlementTriggered` event
//! 3. Service instructs bank partner to execute UPI push payment
//! 4. On success, registered oracle calls `confirm_upi_payment` with UTR number
//! 5. `pallet_remittance` order is updated to Completed
//!
//! ## UTR Number
//! Unique Transaction Reference (UTR) is the 22-character NPCI identifier
//! for every UPI/NEFT/RTGS transaction. Stored on-chain as proof of delivery.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub fn is_valid_utr(utr: &[u8]) -> bool {
    (12..=22).contains(&utr.len()) && utr.iter().all(|b| b.is_ascii_alphanumeric())
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
    use frame_system::pallet_prelude::*;

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct OracleInfo<AccountId, BlockNumber> {
        pub account: AccountId,
        pub name: BoundedVec<u8, ConstU32<64>>,
        pub registered_at: BlockNumber,
        pub total_confirmations: u64,
        pub is_active: bool,
    }

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct UpiConfirmation<BlockNumber> {
        pub order_id: [u8; 32],
        pub utr_number: BoundedVec<u8, ConstU32<22>>,
        pub amount_paise: u64,
        pub confirmed_at: BlockNumber,
        pub oracle: BoundedVec<u8, ConstU32<64>>, // oracle name for auditability
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Governance origin to add/remove oracle accounts
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Whitelisted UPI oracle accounts (registered NBFC / AD-I bank partners)
    #[pallet::storage]
    #[pallet::getter(fn oracles)]
    pub type Oracles<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        OracleInfo<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// Confirmations indexed by order ID (for auditability)
    #[pallet::storage]
    #[pallet::getter(fn confirmations)]
    pub type Confirmations<T: Config> =
        StorageMap<_, Blake2_128Concat, [u8; 32], UpiConfirmation<BlockNumberFor<T>>, OptionQuery>;

    /// Total INR settled via this bridge (in paise)
    #[pallet::storage]
    pub type TotalSettledPaise<T: Config> = StorageValue<_, u128, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        OracleRegistered {
            account: T::AccountId,
            name: BoundedVec<u8, ConstU32<64>>,
        },
        OracleDeregistered {
            account: T::AccountId,
        },
        UpiPaymentConfirmed {
            order_id: [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
            amount_paise: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        OracleNotFound,
        OracleInactive,
        OracleAlreadyRegistered,
        UnauthorizedOracle,
        AlreadyConfirmed,
        InvalidUtrFormat,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Register an oracle account (governance only — requires NBFC/AD-I license)
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 4096))]
        pub fn register_oracle(
            origin: OriginFor<T>,
            account: T::AccountId,
            name: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(
                !Oracles::<T>::contains_key(&account),
                Error::<T>::OracleAlreadyRegistered
            );

            let info = OracleInfo {
                account: account.clone(),
                name: name.clone(),
                registered_at: <frame_system::Pallet<T>>::block_number(),
                total_confirmations: 0,
                is_active: true,
            };
            Oracles::<T>::insert(&account, info);
            Self::deposit_event(Event::OracleRegistered { account, name });
            Ok(())
        }

        /// Confirm a UPI payment (oracle accounts only)
        ///
        /// Called after the AD-I bank partner confirms the UPI push payment.
        /// The UTR number serves as irrefutable proof of fiat delivery.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(80_000_000, 8192))]
        pub fn confirm_upi_payment(
            origin: OriginFor<T>,
            order_id: [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
            amount_paise: u64,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;

            // Validate oracle
            let mut oracle_info =
                Oracles::<T>::get(&caller).ok_or(Error::<T>::UnauthorizedOracle)?;
            ensure!(oracle_info.is_active, Error::<T>::OracleInactive);
            ensure!(
                !Confirmations::<T>::contains_key(order_id),
                Error::<T>::AlreadyConfirmed
            );

            // Basic UTR format: alphanumeric, 12–22 chars
            ensure!(
                crate::is_valid_utr(&utr_number),
                Error::<T>::InvalidUtrFormat
            );

            let current_block = <frame_system::Pallet<T>>::block_number();
            let confirmation = UpiConfirmation {
                order_id,
                utr_number: utr_number.clone(),
                amount_paise,
                confirmed_at: current_block,
                oracle: oracle_info.name.clone(),
            };

            Confirmations::<T>::insert(order_id, confirmation);
            TotalSettledPaise::<T>::mutate(|v| *v = v.saturating_add(amount_paise as u128));

            oracle_info.total_confirmations = oracle_info.total_confirmations.saturating_add(1);
            Oracles::<T>::insert(&caller, oracle_info);

            Self::deposit_event(Event::UpiPaymentConfirmed {
                order_id,
                utr_number,
                amount_paise,
            });
            Ok(())
        }

        /// Deactivate an oracle (governance only)
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(30_000_000, 4096))]
        pub fn deregister_oracle(origin: OriginFor<T>, account: T::AccountId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            Oracles::<T>::try_mutate(&account, |maybe_oracle| {
                let oracle = maybe_oracle.as_mut().ok_or(Error::<T>::OracleNotFound)?;
                oracle.is_active = false;
                Ok::<(), DispatchError>(())
            })?;
            Self::deposit_event(Event::OracleDeregistered { account });
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utr_format_validation_works() {
        assert!(is_valid_utr(b"HDFC1234567890"));
        assert!(!is_valid_utr(b"too_short"));
        assert!(!is_valid_utr(b"HDFC1234-INVALID"));
    }
}
