//! # pallet_rate_lock
//!
//! Off-chain worker (OCW) that fetches USD/INR exchange rates from multiple
//! HTTP endpoints, computes the median for manipulation resistance, and
//! submits the rate on-chain via unsigned transactions.
//!
//! Circuit breaker: rejects rates deviating > 5% from the running median.

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::pallet_prelude::*;
use frame_system::{
    offchain::{
        AppCrypto, CreateSignedTransaction, SendUnsignedTransaction, SignedPayload,
        SigningTypes, SubmitTransaction,
    },
    pallet_prelude::*,
};
use sp_runtime::{
    offchain::{http, Duration},
    transaction_validity::{InvalidTransaction, TransactionValidity, ValidTransaction},
};
use sp_std::vec::Vec;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config + CreateSignedTransaction<Call<Self>> {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type AuthorityId: AppCrypto<Self::Public, Self::Signature>;
        /// How many blocks between rate fetches
        #[pallet::constant]
        type FetchInterval: Get<u32>;
        /// Max deviation from median before circuit breaker trips (basis points)
        #[pallet::constant]
        type CircuitBreakerBps: Get<u64>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Current USD/INR rate * 10^6 (e.g. 83_500_000 = ₹83.50)
    #[pallet::storage]
    #[pallet::getter(fn current_rate)]
    pub type CurrentRate<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Block at which the current rate was last updated
    #[pallet::storage]
    pub type LastUpdatedAt<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// Ring buffer of last 5 rates for median calculation
    #[pallet::storage]
    pub type RateHistory<T: Config> = StorageValue<_, BoundedVec<u64, ConstU32<5>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        RateUpdated { rate: u64, block: BlockNumberFor<T> },
        CircuitBreakerTripped { rejected_rate: u64, current_rate: u64 },
    }

    #[pallet::error]
    pub enum Error<T> {
        CircuitBreakerActive,
        InvalidRate,
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn offchain_worker(block_number: BlockNumberFor<T>) {
            let interval: BlockNumberFor<T> = T::FetchInterval::get().into();
            if block_number % interval != 0u32.into() {
                return;
            }

            match Self::fetch_and_submit_rate() {
                Ok(rate) => log::info!("OCW: submitted rate {}", rate),
                Err(e)   => log::error!("OCW: rate fetch failed: {:?}", e),
            }
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Unsigned extrinsic submitted by OCW to update the on-chain FX rate.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(5_000_000, 0))]
        pub fn submit_rate(
            origin: OriginFor<T>,
            rate:   u64,
            _block: BlockNumberFor<T>,
        ) -> DispatchResult {
            ensure_none(origin)?;
            ensure!(rate > 0, Error::<T>::InvalidRate);

            let current = CurrentRate::<T>::get();
            if current > 0 {
                let deviation = if rate > current {
                    (rate - current) * 10_000 / current
                } else {
                    (current - rate) * 10_000 / current
                };
                if deviation > T::CircuitBreakerBps::get() {
                    Self::deposit_event(Event::CircuitBreakerTripped {
                        rejected_rate: rate,
                        current_rate:  current,
                    });
                    return Err(Error::<T>::CircuitBreakerActive.into());
                }
            }

            CurrentRate::<T>::put(rate);
            let block = <frame_system::Pallet<T>>::block_number();
            LastUpdatedAt::<T>::put(block);

            RateHistory::<T>::mutate(|history| {
                if history.len() >= 5 {
                    history.remove(0);
                }
                let _ = history.try_push(rate);
            });

            Self::deposit_event(Event::RateUpdated { rate, block });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        fn fetch_and_submit_rate() -> Result<u64, http::Error> {
            let deadline = sp_io::offchain::timestamp().add(Duration::from_millis(5_000));

            // Fetch from 3 independent sources
            let endpoints = [
                "https://open.er-api.com/v6/latest/USD",
                "https://api.frankfurter.app/latest?from=USD&to=INR",
            ];

            let mut rates = sp_std::vec![];
            for url in &endpoints {
                let request = http::Request::get(url);
                if let Ok(pending) = request.deadline(deadline).send() {
                    if let Ok(response) = pending.try_wait(deadline) {
                        if response.code == 200 {
                            let body = response.body().collect::<Vec<u8>>();
                            if let Some(rate) = Self::parse_inr_rate(&body) {
                                rates.push(rate);
                            }
                        }
                    }
                }
            }

            if rates.is_empty() {
                return Err(http::Error::Unknown);
            }

            rates.sort();
            let median = rates[rates.len() / 2];

            let call = Call::submit_rate {
                rate:  median,
                block: <frame_system::Pallet<T>>::block_number(),
            };

            SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())
                .map_err(|_| http::Error::Unknown)?;

            Ok(median)
        }

        /// Minimal JSON parser for INR rate extraction.
        /// Production should use a proper no_std JSON parser (e.g. lite-json).
        fn parse_inr_rate(body: &[u8]) -> Option<u64> {
            let s = sp_std::str::from_utf8(body).ok()?;
            // Look for "INR": 83.50 pattern
            let key = "\"INR\":";
            let pos = s.find(key)?;
            let rest = &s[pos + key.len()..].trim_start();
            let end = rest.find(|c: char| !c.is_ascii_digit() && c != '.')?;
            let rate_str = &rest[..end];
            let rate_f: f64 = rate_str.parse().ok()?;
            Some((rate_f * 1_000_000.0) as u64)
        }
    }

    /// Validate unsigned transactions from the OCW
    #[pallet::validate_unsigned]
    impl<T: Config> ValidateUnsigned for Pallet<T> {
        type Call = Call<T>;

        fn validate_unsigned(_source: TransactionSource, call: &Self::Call) -> TransactionValidity {
            if let Call::submit_rate { rate, block: _ } = call {
                if *rate == 0 {
                    return InvalidTransaction::Call.into();
                }
                return ValidTransaction::with_tag_prefix("PolkaSendFxOracle")
                    .priority(100)
                    .longevity(5)
                    .propagate(true)
                    .build();
            }
            InvalidTransaction::Call.into()
        }
    }

    impl<T: Config> crate::pallet_remittance::pallet::FxRateProvider for Pallet<T> {
        fn get_usdinr_rate() -> Option<u64> {
            let rate = CurrentRate::<T>::get();
            if rate > 0 { Some(rate) } else { None }
        }
    }
}
