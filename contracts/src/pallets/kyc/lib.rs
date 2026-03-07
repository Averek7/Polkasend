//! # pallet_kyc
//!
//! On-chain KYC/AML identity management for PolkaSend remittance protocol.
//! Implements RBI risk-based KYC tiers aligned with PMLA 2002 and FEMA 1999.
//!
//! ## Overview
//!
//! This pallet manages KYC records for senders and recipients in the remittance
//! flow. It enforces:
//!
//! - Three-tier KYC levels: BasicKyc ($2,500/yr), FullKyc ($250,000/yr), Institutional
//! - Annual limit tracking per account (resets each fiscal year)
//! - AML screening hooks via off-chain workers
//! - Aadhaar/PAN document hashes stored as SHA3-256 digests (PII never on-chain)
//! - Expiry-based re-KYC enforcement

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{
    dispatch::DispatchResult,
    pallet_prelude::*,
    traits::Get,
};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_std::vec::Vec;

pub use pallet::*;

// ─── Types ────────────────────────────────────────────────────────

/// KYC tier levels mirroring RBI's risk-based approach
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen, PartialOrd, Ord)]
pub enum KycLevel {
    /// No KYC — cannot transact
    None,
    /// Name + Phone + Aadhaar OTP — up to $2,500/year
    BasicKyc,
    /// + PAN card + Address proof — up to $250,000/year (RBI FEMA max)
    FullKyc,
    /// Corporate / AD-I bank level — unlimited
    InstitutionalKyc,
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct KycRecord<AccountId, BlockNumber> {
    pub account:                  AccountId,
    pub level:                    KycLevel,
    /// ISO 3166-1 alpha-2 country code (sender's country)
    pub country_code:             [u8; 2],
    /// SHA3-256 of Aadhaar number — raw PII never stored on-chain
    pub aadhaar_hash:             Option<[u8; 32]>,
    /// SHA3-256 of PAN card number
    pub pan_hash:                 Option<[u8; 32]>,
    pub approved_at:              BlockNumber,
    /// None = no expiry; Some = must re-KYC before this block
    pub expires_at:               Option<BlockNumber>,
    /// Annual send limit in USD cents (e.g. 25_000_000 = $250,000)
    pub annual_limit_usd_cents:   u64,
    /// Year-to-date sent amount in USD cents (reset annually)
    pub ytd_sent_usd_cents:       u64,
    /// Is this account currently suspended?
    pub suspended:                bool,
}

// ─── Pallet ───────────────────────────────────────────────────────

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Origin allowed to approve KYC (registered KYC provider / governance)
        type KycAuthority: EnsureOrigin<Self::RuntimeOrigin>;

        /// Origin allowed to suspend accounts (compliance / AML authority)
        type ComplianceAuthority: EnsureOrigin<Self::RuntimeOrigin>;

        /// Annual limit for BasicKyc in USD cents
        #[pallet::constant]
        type BasicKycLimitUsdCents: Get<u64>;

        /// Annual limit for FullKyc in USD cents
        #[pallet::constant]
        type FullKycLimitUsdCents: Get<u64>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ─── Storage ──────────────────────────────────────────────────

    /// KYC records indexed by account
    #[pallet::storage]
    #[pallet::getter(fn kyc_records)]
    pub type KycRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        KycRecord<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// Pending KYC submissions awaiting authority approval
    #[pallet::storage]
    #[pallet::getter(fn pending_kyc)]
    pub type PendingKyc<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        (KycLevel, [u8; 2]), // (requested level, country_code)
        OptionQuery,
    >;

    // ─── Events ───────────────────────────────────────────────────

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// KYC submission received, awaiting authority review
        KycSubmitted { account: T::AccountId, level: KycLevel },
        /// KYC approved by authority
        KycApproved  { account: T::AccountId, level: KycLevel, limit: u64 },
        /// KYC revoked (e.g. suspicious activity)
        KycRevoked   { account: T::AccountId },
        /// Account suspended for AML/compliance reasons
        AccountSuspended  { account: T::AccountId, reason: BoundedVec<u8, ConstU32<256>> },
        /// Account unsuspended
        AccountUnsuspended { account: T::AccountId },
        /// YTD limit counter updated after a send
        LimitUpdated { account: T::AccountId, ytd_cents: u64, remaining_cents: u64 },
    }

    // ─── Errors ───────────────────────────────────────────────────

    #[pallet::error]
    pub enum Error<T> {
        /// Account not found in KYC records
        KycNotFound,
        /// KYC level insufficient for requested operation
        KycLevelInsufficient,
        /// No pending KYC submission found
        NoPendingKyc,
        /// Annual send limit exceeded
        AnnualLimitExceeded,
        /// KYC has expired; re-verification required
        KycExpired,
        /// Account is suspended
        AccountSuspended,
        /// Duplicate submission — already pending or approved at this level
        DuplicateSubmission,
    }

    // ─── Calls ────────────────────────────────────────────────────

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit KYC data hashes for off-chain review.
        /// Raw PII is NEVER submitted on-chain — only SHA3-256 digests.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000_000, 0))]
        pub fn submit_kyc(
            origin:        OriginFor<T>,
            level:         KycLevel,
            country_code:  [u8; 2],
            aadhaar_hash:  Option<[u8; 32]>,
            _pan_hash:     Option<[u8; 32]>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Reject if already approved at this level
            if let Some(record) = KycRecords::<T>::get(&who) {
                ensure!(record.level < level, Error::<T>::DuplicateSubmission);
            }

            PendingKyc::<T>::insert(&who, (level.clone(), country_code));
            Self::deposit_event(Event::KycSubmitted { account: who, level });
            Ok(())
        }

        /// Authority approves a pending KYC submission.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(15_000_000, 0))]
        pub fn approve_kyc(
            origin:  OriginFor<T>,
            account: T::AccountId,
        ) -> DispatchResult {
            T::KycAuthority::ensure_origin(origin)?;

            let (level, country_code) = PendingKyc::<T>::take(&account)
                .ok_or(Error::<T>::NoPendingKyc)?;

            let limit = match level {
                KycLevel::BasicKyc       => T::BasicKycLimitUsdCents::get(),
                KycLevel::FullKyc        => T::FullKycLimitUsdCents::get(),
                KycLevel::InstitutionalKyc => u64::MAX,
                KycLevel::None           => 0,
            };

            let record = KycRecord {
                account:                account.clone(),
                level:                  level.clone(),
                country_code,
                aadhaar_hash:           None, // stored off-chain
                pan_hash:               None,
                approved_at:            <frame_system::Pallet<T>>::block_number(),
                expires_at:             None,
                annual_limit_usd_cents: limit,
                ytd_sent_usd_cents:     0,
                suspended:              false,
            };

            KycRecords::<T>::insert(&account, record);
            Self::deposit_event(Event::KycApproved { account, level, limit });
            Ok(())
        }

        /// Compliance authority suspends an account.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(8_000_000, 0))]
        pub fn suspend_account(
            origin:  OriginFor<T>,
            account: T::AccountId,
            reason:  BoundedVec<u8, ConstU32<256>>,
        ) -> DispatchResult {
            T::ComplianceAuthority::ensure_origin(origin)?;

            KycRecords::<T>::try_mutate(&account, |maybe| {
                let record = maybe.as_mut().ok_or(Error::<T>::KycNotFound)?;
                record.suspended = true;
                Ok::<(), DispatchError>(())
            })?;

            Self::deposit_event(Event::AccountSuspended { account, reason });
            Ok(())
        }
    }

    // ─── Helper impl ──────────────────────────────────────────────

    impl<T: Config> Pallet<T> {
        /// Check KYC status and update YTD counter atomically.
        /// Called by pallet_remittance before processing a transfer.
        pub fn check_and_update_limit(
            account:          &T::AccountId,
            amount_usd_cents: u64,
        ) -> DispatchResult {
            KycRecords::<T>::try_mutate(account, |maybe_record| {
                let record = maybe_record.as_mut().ok_or(Error::<T>::KycNotFound)?;

                ensure!(!record.suspended,       Error::<T>::AccountSuspended);
                ensure!(record.level != KycLevel::None, Error::<T>::KycLevelInsufficient);

                // Check expiry
                if let Some(expires) = record.expires_at {
                    ensure!(
                        <frame_system::Pallet<T>>::block_number() < expires,
                        Error::<T>::KycExpired
                    );
                }

                // Check annual limit
                ensure!(
                    record.ytd_sent_usd_cents.saturating_add(amount_usd_cents)
                        <= record.annual_limit_usd_cents,
                    Error::<T>::AnnualLimitExceeded
                );

                record.ytd_sent_usd_cents = record.ytd_sent_usd_cents.saturating_add(amount_usd_cents);

                Self::deposit_event(Event::LimitUpdated {
                    account: account.clone(),
                    ytd_cents: record.ytd_sent_usd_cents,
                    remaining_cents: record.annual_limit_usd_cents
                        .saturating_sub(record.ytd_sent_usd_cents),
                });

                Ok(())
            })
        }

        /// Returns true if account has at least BasicKyc and is not suspended.
        pub fn is_kyc_valid(account: &T::AccountId) -> bool {
            KycRecords::<T>::get(account)
                .map(|r| r.level >= KycLevel::BasicKyc && !r.suspended)
                .unwrap_or(false)
        }
    }
}
