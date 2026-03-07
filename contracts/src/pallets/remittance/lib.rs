//! # pallet_remittance
//!
//! Core remittance logic for the PolkaSend parachain.
//! Handles order lifecycle: creation → rate lock → compliance → XCM bridging → settlement.

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{
    dispatch::DispatchResult,
    pallet_prelude::*,
    traits::{
        fungibles::{Inspect, Transfer},
        tokens::Preservation,
    },
    PalletId,
};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::traits::{AccountIdConversion, StaticLookup};
use sp_std::vec::Vec;

pub use pallet::*;

/// How the recipient receives their INR
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum DeliveryMode {
    /// Instant UPI push payment — ~30 seconds
    UpiInstant { vpa: BoundedVec<u8, ConstU32<50>> },
    /// IMPS / NEFT bank transfer — ~2 minutes
    BankTransfer {
        ifsc:           [u8; 11],
        account_number: BoundedVec<u8, ConstU32<20>>,
    },
    /// iINR stablecoin to on-chain wallet — ~6 seconds
    IinrWallet,
    /// Aadhaar-linked biometric payment — ~45 seconds
    AadhaarPay { aadhaar_last4: [u8; 4] },
}

/// Order lifecycle status
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum RemittanceStatus {
    Initiated,
    RateLocked { fx_rate: u64 },
    CompliancePassed,
    XcmSent { xcm_hash: [u8; 32] },
    SettlementTriggered,
    Completed { utr_number: BoundedVec<u8, ConstU32<22>> },
    Failed    { reason:     BoundedVec<u8, ConstU32<128>> },
    Expired,
}

/// Core remittance order
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct RemittanceOrder<AccountId, Balance, BlockNumber> {
    pub id:                      [u8; 32],
    pub sender:                  AccountId,
    pub recipient:               AccountId,
    pub asset_id:                u32,
    pub amount_in:               Balance,
    /// Net INR amount in paise (1 INR = 100 paise)
    pub amount_out_inr_paise:    u64,
    /// FX rate * 10^6 (83.50 → 83_500_000)
    pub fx_rate_locked:          u64,
    pub protocol_fee_paise:      u64,
    pub delivery_mode:           DeliveryMode,
    pub status:                  RemittanceStatus,
    pub created_at:              BlockNumber,
    pub expires_at:              BlockNumber,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_kyc::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type Assets: Inspect<Self::AccountId, AssetId = u32, Balance = u128>
            + Transfer<Self::AccountId>;

        type FxOracle: FxRateProvider;

        type SettlementOracle: EnsureOrigin<Self::RuntimeOrigin>;

        #[pallet::constant]
        type PalletId: Get<PalletId>;

        #[pallet::constant]
        type ProtocolFeeBps: Get<u64>;

        #[pallet::constant]
        type RateLockBlocks: Get<u32>;

        #[pallet::constant]
        type MinAmountUsdcMicro: Get<u128>;
    }

    pub trait FxRateProvider {
        fn get_usdinr_rate() -> Option<u64>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ─── Storage ─────────────────────────────────────────────────

    #[pallet::storage]
    #[pallet::getter(fn orders)]
    pub type Orders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        [u8; 32],
        RemittanceOrder<T::AccountId, u128, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::storage]
    pub type UserOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<[u8; 32], ConstU32<200>>,
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn total_volume_paise)]
    pub type TotalVolumePaise<T: Config> = StorageValue<_, u128, ValueQuery>;

    // ─── Events ──────────────────────────────────────────────────

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        OrderCreated   { order_id: [u8; 32], sender: T::AccountId, amount_usdc: u128 },
        RateLocked     { order_id: [u8; 32], fx_rate: u64, inr_paise: u64 },
        XcmDispatched  { order_id: [u8; 32], xcm_hash: [u8; 32] },
        OrderCompleted { order_id: [u8; 32], utr_number: BoundedVec<u8, ConstU32<22>> },
        OrderFailed    { order_id: [u8; 32], reason: BoundedVec<u8, ConstU32<128>> },
        OrderExpired   { order_id: [u8; 32] },
    }

    #[pallet::error]
    pub enum Error<T> {
        KycRequired,
        InsufficientBalance,
        RateUnavailable,
        OrderNotFound,
        OrderExpired,
        OrderAlreadyCompleted,
        NotSettlementOracle,
        AmountTooSmall,
        TooManyOrders,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Initiate a remittance order with on-chain FX rate lock.
        /// Escrowed funds held in pallet sovereign account until settlement.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(250_000_000, 10_000))]
        pub fn initiate_remittance(
            origin:        OriginFor<T>,
            recipient:     <T::Lookup as StaticLookup>::Source,
            asset_id:      u32,
            amount:        u128,
            delivery_mode: DeliveryMode,
        ) -> DispatchResult {
            let sender = ensure_signed(origin)?;
            let recipient = T::Lookup::lookup(recipient)?;

            // ── Validation ──────────────────────────────────────
            ensure!(amount >= T::MinAmountUsdcMicro::get(), Error::<T>::AmountTooSmall);

            // KYC gate (delegates to pallet_kyc)
            let amount_usd_cents = (amount / 10_000) as u64; // USDC 6 decimals → cents
            pallet_kyc::Pallet::<T>::check_and_update_limit(&sender, amount_usd_cents)?;

            // ── FX Rate Lock ─────────────────────────────────────
            let fx_rate = T::FxOracle::get_usdinr_rate()
                .ok_or(Error::<T>::RateUnavailable)?;

            // INR paise = amount_usdc * fx_rate * 100 / 10^12
            // (USDC has 6 decimals, fx_rate is * 10^6, 100 paise/INR)
            let inr_paise = (amount as u128)
                .saturating_mul(fx_rate as u128)
                .saturating_mul(100)
                / 1_000_000_000_000u128;

            let fee_bps = T::ProtocolFeeBps::get();
            let fee_paise = (inr_paise * fee_bps as u128 / 10_000) as u64;
            let net_paise = (inr_paise as u64).saturating_sub(fee_paise);

            // ── Escrow ───────────────────────────────────────────
            let escrow = Self::account_id();
            T::Assets::transfer(asset_id, &sender, &escrow, amount, Preservation::Expendable)?;

            // ── Create Order ─────────────────────────────────────
            let order_id = Self::derive_order_id(&sender, &recipient, amount);
            let current_block = <frame_system::Pallet<T>>::block_number();

            let order = RemittanceOrder {
                id: order_id,
                sender: sender.clone(),
                recipient,
                asset_id,
                amount_in: amount,
                amount_out_inr_paise: net_paise,
                fx_rate_locked: fx_rate,
                protocol_fee_paise: fee_paise,
                delivery_mode,
                status: RemittanceStatus::RateLocked { fx_rate },
                created_at: current_block,
                expires_at: current_block + T::RateLockBlocks::get().into(),
            };

            Orders::<T>::insert(order_id, &order);
            UserOrders::<T>::try_mutate(&sender, |v| v.try_push(order_id))
                .map_err(|_| Error::<T>::TooManyOrders)?;
            TotalVolumePaise::<T>::mutate(|v| *v = v.saturating_add(net_paise as u128));

            Self::deposit_event(Event::OrderCreated { order_id, sender, amount_usdc: amount });
            Self::deposit_event(Event::RateLocked { order_id, fx_rate, inr_paise: net_paise });

            Ok(())
        }

        /// Settlement oracle confirms successful fiat delivery.
        /// Called by the authorized NBFC oracle after UPI/IMPS confirmation.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(50_000_000, 5_000))]
        pub fn confirm_settlement(
            origin:     OriginFor<T>,
            order_id:   [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
        ) -> DispatchResult {
            T::SettlementOracle::ensure_origin(origin)?;

            Orders::<T>::try_mutate(order_id, |maybe| {
                let order = maybe.as_mut().ok_or(Error::<T>::OrderNotFound)?;
                ensure!(
                    !matches!(order.status, RemittanceStatus::Completed { .. }),
                    Error::<T>::OrderAlreadyCompleted
                );
                order.status = RemittanceStatus::Completed {
                    utr_number: utr_number.clone(),
                };
                Ok::<(), DispatchError>(())
            })?;

            Self::deposit_event(Event::OrderCompleted { order_id, utr_number });
            Ok(())
        }

        /// Mark an order as failed and refund escrowed assets.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(60_000_000, 5_000))]
        pub fn fail_order(
            origin:   OriginFor<T>,
            order_id: [u8; 32],
            reason:   BoundedVec<u8, ConstU32<128>>,
        ) -> DispatchResult {
            T::SettlementOracle::ensure_origin(origin)?;

            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;

            // Refund escrowed amount
            let escrow = Self::account_id();
            T::Assets::transfer(
                order.asset_id,
                &escrow,
                &order.sender,
                order.amount_in,
                Preservation::Expendable,
            )?;

            Orders::<T>::mutate(order_id, |maybe| {
                if let Some(o) = maybe {
                    o.status = RemittanceStatus::Failed { reason: reason.clone() };
                }
            });

            Self::deposit_event(Event::OrderFailed { order_id, reason });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Pallet sovereign account (escrow for in-flight funds)
        pub fn account_id() -> T::AccountId {
            T::PalletId::get().into_account_truncating()
        }

        /// Deterministic order ID from sender + recipient + amount + block
        fn derive_order_id(
            sender:    &T::AccountId,
            recipient: &T::AccountId,
            amount:    u128,
        ) -> [u8; 32] {
            let mut data = sp_std::vec![];
            data.extend_from_slice(&sender.encode());
            data.extend_from_slice(&recipient.encode());
            data.extend_from_slice(&amount.encode());
            data.extend_from_slice(&<frame_system::Pallet<T>>::block_number().encode());
            sp_io::hashing::blake2_256(&data)
        }
    }
}
