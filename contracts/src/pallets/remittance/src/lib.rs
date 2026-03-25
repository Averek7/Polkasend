//! # pallet-remittance
//!
//! Core remittance logic for the PolkaSend parachain.
//! Handles order lifecycle: initiation → rate lock → compliance → settlement → completion.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub fn compute_gross_inr_paise(amount_micro: u128, fx_rate_scaled: u64) -> u64 {
    (amount_micro
        .saturating_mul(fx_rate_scaled as u128)
        .saturating_mul(100)
        / 1_000_000_000_000u128) as u64
}

pub fn compute_fee_paise(gross_inr_paise: u64, protocol_fee_bps: u64) -> u64 {
    gross_inr_paise.saturating_mul(protocol_fee_bps) / 10_000
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        dispatch::DispatchResult,
        pallet_prelude::*,
        traits::fungibles::{Inspect, Transfer},
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::StaticLookup;
    use sp_std::vec::Vec;

    // ─── Delivery mode ────────────────────────────────────────────────────────

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum DeliveryMode {
        CryptoWallet,
        UpiInstant    { upi_id: BoundedVec<u8, ConstU32<50>> },
        BankTransfer  {
            ifsc: [u8; 11],
            account_number: BoundedVec<u8, ConstU32<20>>,
        },
        AadhaarPay    { aadhaar_hash: [u8; 32] },
    }

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum RemittanceStatus {
        Initiated,
        RateLocked,
        CompliancePassed,
        SettlementTriggered,
        Completed { utr_number: BoundedVec<u8, ConstU32<22>> },
        Failed    { reason: BoundedVec<u8, ConstU32<64>> },
        Expired,
    }

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct RemittanceOrder<AccountId, AssetId, Balance, BlockNumber> {
        pub id: [u8; 32],
        pub sender: AccountId,
        pub recipient: AccountId,
        pub asset_id: AssetId,
        /// Amount in asset's native micro-units (e.g., USDC 6-decimal)
        pub amount_in: Balance,
        /// Guaranteed INR output in paise (1 INR = 100 paise)
        pub amount_out_inr_paise: u64,
        /// FX rate * 10^6 at time of lock
        pub fx_rate_locked: u64,
        /// Protocol fee in paise
        pub fee_paise: u64,
        pub delivery_mode: DeliveryMode,
        pub status: RemittanceStatus,
        pub created_at: BlockNumber,
        /// Order expires after ~15 min (150 blocks at 6s)
        pub expires_at: BlockNumber,
    }

    // ─── Config ───────────────────────────────────────────────────────────────

    pub trait FxRateProvider {
        /// Returns current USD/INR rate * 10^6, or None if unavailable
        fn get_usdinr_rate() -> Option<u64>;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_kyc::Config {
        type RuntimeEvent: From<Event<Self>>
            + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type Assets: Inspect<Self::AccountId, AssetId = u32, Balance = u128>
            + Transfer<Self::AccountId>;

        #[pallet::constant]
        type TreasuryAccount: Get<Self::AccountId>;

        /// Protocol fee in basis points (50 = 0.5%)
        #[pallet::constant]
        type ProtocolFeeBps: Get<u64>;

        /// Minimum send amount in USDC micro-units ($1 = 1_000_000)
        #[pallet::constant]
        type MinSendAmount: Get<u128>;

        /// Blocks until rate lock expires (~15 min at 6s/block = 150 blocks)
        #[pallet::constant]
        type RateLockBlocks: Get<BlockNumberFor<Self>>;

        type FxOracle: FxRateProvider;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn orders)]
    pub type Orders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        [u8; 32],
        RemittanceOrder<T::AccountId, u32, u128, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn user_orders)]
    pub type UserOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<[u8; 32], ConstU32<200>>,
        ValueQuery,
    >;

    /// Total protocol volume in USDC micro-units (for TVL tracking)
    #[pallet::storage]
    pub type TotalVolumeUsdc<T: Config> = StorageValue<_, u128, ValueQuery>;

    // ─── Events ───────────────────────────────────────────────────────────────

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        OrderCreated    { order_id: [u8; 32], sender: T::AccountId, amount_usdc: u128 },
        RateLocked      { order_id: [u8; 32], fx_rate: u64, inr_amount_paise: u64 },
        SettlementTrig  { order_id: [u8; 32] },
        OrderCompleted  { order_id: [u8; 32], utr_number: BoundedVec<u8, ConstU32<22>> },
        OrderFailed     { order_id: [u8; 32], reason: BoundedVec<u8, ConstU32<64>> },
        OrderExpired    { order_id: [u8; 32] },
        FundsRefunded   { order_id: [u8; 32], sender: T::AccountId, amount: u128 },
    }

    // ─── Errors ───────────────────────────────────────────────────────────────

    #[pallet::error]
    pub enum Error<T> {
        KycRequired,
        InsufficientBalance,
        FxRateUnavailable,
        OrderNotFound,
        OrderExpired,
        NotOrderOwner,
        InvalidAmount,
        TooManyOrders,
        OrderAlreadyCompleted,
    }

    // ─── Calls ────────────────────────────────────────────────────────────────

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Initiate a remittance order.
        ///
        /// Validates KYC, locks FX rate, escrows stablecoin in treasury,
        /// and emits `OrderCreated` + `RateLocked` events in one extrinsic.
        ///
        /// # Arguments
        /// - `recipient`: On-chain account of recipient (or sovereign account for fiat delivery)
        /// - `asset_id`: Stablecoin asset ID (USDC = 1337, USDT = 1984)
        /// - `amount`: Amount in asset micro-units
        /// - `delivery_mode`: How INR should reach the recipient
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(300_000_000, 32768))]
        pub fn initiate_remittance(
            origin: OriginFor<T>,
            recipient: <T::Lookup as StaticLookup>::Source,
            asset_id: u32,
            amount: u128,
            delivery_mode: DeliveryMode,
        ) -> DispatchResult {
            let sender = ensure_signed(origin)?;
            let recipient_account = T::Lookup::lookup(recipient)?;

            // ── 1. KYC gate ────────────────────────────────────────────────
            ensure!(
                pallet_kyc::KycRecords::<T>::contains_key(&sender),
                Error::<T>::KycRequired
            );

            // ── 2. Minimum amount ($1 USDC) ────────────────────────────────
            ensure!(amount >= T::MinSendAmount::get(), Error::<T>::InvalidAmount);

            // ── 3. FEMA annual limit check ─────────────────────────────────
            // Convert USDC micro-units to USD cents (6 decimal → 2 decimal)
            let amount_usd_cents = (amount / 10_000) as u64;
            pallet_kyc::Pallet::<T>::check_and_update_limit(&sender, amount_usd_cents)?;

            // ── 4. FX rate lock ────────────────────────────────────────────
            let fx_rate = T::FxOracle::get_usdinr_rate()
                .ok_or(Error::<T>::FxRateUnavailable)?;

            // INR paise = (USDC_micro * rate * 100) / 10^12
            // rate is * 10^6, USDC is * 10^6 → divide by 10^12 for INR units, * 100 for paise
            let inr_paise_gross = crate::compute_gross_inr_paise(amount, fx_rate);

            // Protocol fee
            let fee_bps = T::ProtocolFeeBps::get();
            let fee_paise = crate::compute_fee_paise(inr_paise_gross, fee_bps);
            let inr_paise_net = inr_paise_gross.saturating_sub(fee_paise);

            // ── 5. Escrow funds ────────────────────────────────────────────
            T::Assets::transfer(
                asset_id,
                &sender,
                &T::TreasuryAccount::get(),
                amount,
                frame_support::traits::tokens::Preservation::Expendable,
            )?;

            // ── 6. Create order ────────────────────────────────────────────
            let order_id = Self::generate_order_id(&sender, &recipient_account, amount);
            let current_block = <frame_system::Pallet<T>>::block_number();
            let expires_at = current_block + T::RateLockBlocks::get();

            let order = RemittanceOrder {
                id: order_id,
                sender: sender.clone(),
                recipient: recipient_account,
                asset_id,
                amount_in: amount,
                amount_out_inr_paise: inr_paise_net,
                fx_rate_locked: fx_rate,
                fee_paise,
                delivery_mode,
                status: RemittanceStatus::RateLocked,
                created_at: current_block,
                expires_at,
            };

            Orders::<T>::insert(order_id, order);
            UserOrders::<T>::try_mutate(&sender, |orders| {
                orders.try_push(order_id).map_err(|_| Error::<T>::TooManyOrders)
            })?;

            TotalVolumeUsdc::<T>::mutate(|v| *v = v.saturating_add(amount));

            Self::deposit_event(Event::OrderCreated {
                order_id,
                sender,
                amount_usdc: amount,
            });
            Self::deposit_event(Event::RateLocked {
                order_id,
                fx_rate,
                inr_amount_paise: inr_paise_net,
            });

            Ok(())
        }

        /// Confirm fiat settlement (called by authorized UPI/IMPS oracle).
        ///
        /// The oracle is a registered off-chain worker that monitors UPI payment
        /// confirmations and posts the UTR number on-chain as proof of delivery.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(60_000_000, 4096))]
        pub fn confirm_settlement(
            origin: OriginFor<T>,
            order_id: [u8; 32],
            utr_number: BoundedVec<u8, ConstU32<22>>,
        ) -> DispatchResult {
            let _oracle = ensure_signed(origin)?;
            // In production: ensure_origin checks oracle whitelist

            Orders::<T>::try_mutate(order_id, |maybe_order| {
                let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
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

        /// Expire and refund an order that has passed its rate lock window.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(80_000_000, 8192))]
        pub fn expire_order(
            origin: OriginFor<T>,
            order_id: [u8; 32],
        ) -> DispatchResult {
            ensure_signed(origin)?;

            let order = Orders::<T>::get(order_id)
                .ok_or(Error::<T>::OrderNotFound)?;

            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(current_block > order.expires_at, Error::<T>::OrderExpired);

            // Refund escrowed funds
            T::Assets::transfer(
                order.asset_id,
                &T::TreasuryAccount::get(),
                &order.sender,
                order.amount_in,
                frame_support::traits::tokens::Preservation::Expendable,
            )?;

            Orders::<T>::remove(order_id);
            Self::deposit_event(Event::FundsRefunded {
                order_id,
                sender: order.sender,
                amount: order.amount_in,
            });

            Ok(())
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    impl<T: Config> Pallet<T> {
        fn generate_order_id(
            sender: &T::AccountId,
            recipient: &T::AccountId,
            amount: u128,
        ) -> [u8; 32] {
            let mut input = sp_std::vec![];
            input.extend_from_slice(&sender.encode());
            input.extend_from_slice(&recipient.encode());
            input.extend_from_slice(&amount.encode());
            input.extend_from_slice(
                &<frame_system::Pallet<T>>::block_number().encode()
            );
            sp_io::hashing::blake2_256(&input)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remittance_amount_math_is_stable() {
        let amount_micro = 200_000_000u128; // 200 USDC
        let fx_rate_scaled = 83_500_000u64; // 83.5
        let gross = compute_gross_inr_paise(amount_micro, fx_rate_scaled);
        let fee = compute_fee_paise(gross, 50); // 0.5%
        let net = gross - fee;

        assert!(gross > 0);
        assert_eq!(fee, gross / 200);
        assert!(net < gross);
    }
}
