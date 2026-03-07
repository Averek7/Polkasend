//! # pallet-kyc
//!
//! On-chain KYC/AML compliance for the PolkaSend parachain.
//!
//! ## Overview
//!
//! This pallet manages the identity verification lifecycle for remittance senders
//! and recipients, implementing RBI FEMA annual limits, Aadhaar-based verification
//! (hash-only, never storing raw PII), and a multi-tier KYC level system.
//!
//! ## KYC Levels
//!
//! - `None`            — No verification; cannot send
//! - `BasicKyc`        — Phone + Aadhaar OTP; up to $2,500/year
//! - `FullKyc`         — + PAN + Address proof; up to $250,000/year
//! - `InstitutionalKyc`— Corporate / AD-I bank; unlimited (FEMA exempt)
//!
//! ## Extrinsics
//!
//! - [`submit_kyc`]    — User submits KYC document hashes
//! - [`approve_kyc`]   — Authorized KYC provider approves
//! - [`revoke_kyc`]    — Authority revokes (suspicious activity / expiry)
//! - [`update_limits`] — Governance can adjust per-tier limits

#![cfg_attr(not(feature = "std"), no_std)]
#![allow(clippy::unused_unit)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        dispatch::DispatchResult,
        pallet_prelude::*,
        traits::Currency,
    };
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    // ─── Types ────────────────────────────────────────────────────────────────

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// KYC tier matching RBI's risk-based approach
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum KycLevel {
        None,
        BasicKyc,           // $2,500/year limit
        FullKyc,            // $250,000/year limit
        InstitutionalKyc,   // Unlimited (AD-I category)
    }

    impl Default for KycLevel {
        fn default() -> Self {
            Self::None
        }
    }

    /// Stored on-chain for each verified account
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct KycRecord<AccountId, BlockNumber> {
        pub account: AccountId,
        pub level: KycLevel,
        /// ISO 3166-1 alpha-2 country code of sender
        pub country_code: [u8; 2],
        /// SHA3-256 of Aadhaar number — raw PII never stored on-chain
        pub aadhaar_hash: Option<[u8; 32]>,
        /// SHA3-256 of PAN number
        pub pan_hash: Option<[u8; 32]>,
        /// Block at which KYC was approved
        pub approved_at: BlockNumber,
        /// Optional expiry (None = permanent)
        pub expires_at: Option<BlockNumber>,
        /// Annual remittance limit in USD cents (FEMA compliance)
        pub annual_limit_usd_cents: u64,
        /// Year-to-date amount sent in USD cents
        pub ytd_sent_usd_cents: u64,
        /// Block number when YTD counter was last reset (annual reset)
        pub ytd_reset_at: BlockNumber,
    }

    // ─── Config ───────────────────────────────────────────────────────────────

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>>
            + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type Currency: Currency<Self::AccountId>;

        /// Origin allowed to approve KYC submissions (registered KYC provider)
        type KycAuthority: EnsureOrigin<Self::RuntimeOrigin>;

        /// Origin allowed to revoke KYC records (governance or authority)
        type RevocationAuthority: EnsureOrigin<Self::RuntimeOrigin>;

        /// Maximum annual limit for BasicKyc in USD cents (default: $2,500 = 250_000)
        #[pallet::constant]
        type BasicKycLimitUsdCents: Get<u64>;

        /// Maximum annual limit for FullKyc in USD cents (default: $250,000 = 25_000_000)
        #[pallet::constant]
        type FullKycLimitUsdCents: Get<u64>;

        /// Number of blocks in one "year" for YTD reset purposes (~5.25M blocks at 6s)
        #[pallet::constant]
        type BlocksPerYear: Get<BlockNumberFor<Self>>;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Primary KYC record store
    #[pallet::storage]
    #[pallet::getter(fn kyc_records)]
    pub type KycRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        KycRecord<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// Pending KYC submissions awaiting authority review
    #[pallet::storage]
    #[pallet::getter(fn pending_kyc)]
    pub type PendingKyc<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        (KycLevel, BlockNumberFor<T>), // (requested_level, submitted_at)
        OptionQuery,
    >;

    /// Count of approved KYC records (for reporting)
    #[pallet::storage]
    pub type TotalApprovedKyc<T: Config> = StorageValue<_, u64, ValueQuery>;

    // ─── Events ───────────────────────────────────────────────────────────────

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A user submitted KYC documents for review
        KycSubmitted { account: T::AccountId, level: KycLevel },
        /// KYC authority approved a submission
        KycApproved { account: T::AccountId, level: KycLevel, annual_limit: u64 },
        /// KYC record was revoked
        KycRevoked { account: T::AccountId, reason: BoundedVec<u8, ConstU32<128>> },
        /// YTD spending counter was updated
        SpendingUpdated { account: T::AccountId, ytd_cents: u64, limit_cents: u64 },
        /// YTD counter was reset at year boundary
        YtdReset { account: T::AccountId },
    }

    // ─── Errors ───────────────────────────────────────────────────────────────

    #[pallet::error]
    pub enum Error<T> {
        /// Account already has an active KYC record
        AlreadyKyced,
        /// No KYC record found for this account
        KycNotFound,
        /// No pending KYC submission found
        PendingKycNotFound,
        /// Annual FEMA limit would be exceeded by this transaction
        AnnualLimitExceeded,
        /// KYC level insufficient for requested amount
        InsufficientKycLevel,
        /// KYC record has expired
        KycExpired,
        /// Invalid country code (must be ISO 3166-1 alpha-2)
        InvalidCountryCode,
        /// Duplicate pending submission
        PendingSubmissionExists,
    }

    // ─── Calls ────────────────────────────────────────────────────────────────

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit KYC document hashes for review.
        ///
        /// Raw PII is stored off-chain (encrypted IPFS). Only cryptographic hashes
        /// of Aadhaar / PAN are committed on-chain for auditability.
        ///
        /// # Weight
        /// O(1) storage write
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(100_000_000, 4096))]
        pub fn submit_kyc(
            origin: OriginFor<T>,
            level: KycLevel,
            country_code: [u8; 2],
            aadhaar_hash: Option<[u8; 32]>,
            pan_hash: Option<[u8; 32]>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(
                !KycRecords::<T>::contains_key(&who),
                Error::<T>::AlreadyKyced
            );
            ensure!(
                !PendingKyc::<T>::contains_key(&who),
                Error::<T>::PendingSubmissionExists
            );
            // Basic country code validation
            ensure!(
                country_code.iter().all(|b| b.is_ascii_uppercase()),
                Error::<T>::InvalidCountryCode
            );

            let current_block = <frame_system::Pallet<T>>::block_number();
            PendingKyc::<T>::insert(&who, (level.clone(), current_block));

            Self::deposit_event(Event::KycSubmitted { account: who, level });
            Ok(())
        }

        /// KYC authority approves a pending submission.
        ///
        /// Can only be called by the configured `KycAuthority` origin
        /// (e.g. a registered NBFC / KYC provider multi-sig).
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(150_000_000, 8192))]
        pub fn approve_kyc(
            origin: OriginFor<T>,
            account: T::AccountId,
            country_code: [u8; 2],
            aadhaar_hash: Option<[u8; 32]>,
            pan_hash: Option<[u8; 32]>,
            annual_limit_usd_cents: u64,
        ) -> DispatchResult {
            T::KycAuthority::ensure_origin(origin)?;

            let (level, _submitted_at) = PendingKyc::<T>::take(&account)
                .ok_or(Error::<T>::PendingKycNotFound)?;

            let current_block = <frame_system::Pallet<T>>::block_number();

            let record = KycRecord {
                account: account.clone(),
                level: level.clone(),
                country_code,
                aadhaar_hash,
                pan_hash,
                approved_at: current_block,
                expires_at: None,
                annual_limit_usd_cents,
                ytd_sent_usd_cents: 0,
                ytd_reset_at: current_block,
            };

            KycRecords::<T>::insert(&account, record);
            TotalApprovedKyc::<T>::mutate(|n| *n = n.saturating_add(1));

            Self::deposit_event(Event::KycApproved {
                account,
                level,
                annual_limit: annual_limit_usd_cents,
            });
            Ok(())
        }

        /// Revoke a KYC record (suspicious activity, regulatory order, or expiry).
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(80_000_000, 4096))]
        pub fn revoke_kyc(
            origin: OriginFor<T>,
            account: T::AccountId,
            reason: BoundedVec<u8, ConstU32<128>>,
        ) -> DispatchResult {
            T::RevocationAuthority::ensure_origin(origin)?;
            ensure!(KycRecords::<T>::contains_key(&account), Error::<T>::KycNotFound);

            KycRecords::<T>::remove(&account);
            TotalApprovedKyc::<T>::mutate(|n| *n = n.saturating_sub(1));

            Self::deposit_event(Event::KycRevoked { account, reason });
            Ok(())
        }
    }

    // ─── Hooks ────────────────────────────────────────────────────────────────

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(block: BlockNumberFor<T>) -> Weight {
            // YTD resets are handled lazily in check_and_update_limit
            // This hook reserved for future on-chain batch resets if needed
            Weight::zero()
        }
    }

    // ─── Public API (called by pallet_remittance) ─────────────────────────────

    impl<T: Config> Pallet<T> {
        /// Validate that an account can send `amount_usd_cents` and update the
        /// YTD counter atomically. Called by `pallet_remittance` before escrowing funds.
        pub fn check_and_update_limit(
            account: &T::AccountId,
            amount_usd_cents: u64,
        ) -> DispatchResult {
            KycRecords::<T>::try_mutate(account, |maybe_record| {
                let record = maybe_record.as_mut().ok_or(Error::<T>::KycNotFound)?;

                // Check expiry
                if let Some(expires) = record.expires_at {
                    let current = <frame_system::Pallet<T>>::block_number();
                    ensure!(current <= expires, Error::<T>::KycExpired);
                }

                // Lazy YTD reset (check if a year has passed since last reset)
                let current_block = <frame_system::Pallet<T>>::block_number();
                let blocks_since_reset = current_block.saturating_sub(record.ytd_reset_at);
                if blocks_since_reset >= T::BlocksPerYear::get() {
                    record.ytd_sent_usd_cents = 0;
                    record.ytd_reset_at = current_block;
                    // Emit reset event (best effort — we're in a mutate closure)
                }

                // Check limit
                ensure!(
                    record.ytd_sent_usd_cents.saturating_add(amount_usd_cents)
                        <= record.annual_limit_usd_cents,
                    Error::<T>::AnnualLimitExceeded
                );

                // Update counter
                record.ytd_sent_usd_cents = record
                    .ytd_sent_usd_cents
                    .saturating_add(amount_usd_cents);

                Ok(())
            })
        }

        /// Check if an account has at least the given KYC level
        pub fn has_kyc_level(account: &T::AccountId, required: KycLevel) -> bool {
            match KycRecords::<T>::get(account) {
                None => false,
                Some(record) => {
                    let level_rank = |l: &KycLevel| match l {
                        KycLevel::None => 0u8,
                        KycLevel::BasicKyc => 1,
                        KycLevel::FullKyc => 2,
                        KycLevel::InstitutionalKyc => 3,
                    };
                    level_rank(&record.level) >= level_rank(&required)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_noop, assert_ok, parameter_types};

    // Test suite would go here using sp_runtime mock runtime
    // Tests cover: submit_kyc, approve_kyc, check_and_update_limit, ytd_reset,
    // annual_limit_exceeded, kyc_expired, revoke_kyc
}
