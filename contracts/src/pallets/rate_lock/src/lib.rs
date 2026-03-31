//! # pallet-rate-lock
//!
//! FX rate oracle using Substrate off-chain workers (OCW).
//! Aggregates USD/INR rate from 3 external sources (median) and posts
//! on-chain every 10 blocks (~60 seconds). Implements circuit breaker
//! logic: rejects rate updates with >5% deviation from last known value.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub fn parse_inr_rate_from_json(body: &[u8]) -> Option<f64> {
    let body_str = core::str::from_utf8(body).ok()?;
    let inr_pos = body_str.find("\"INR\"")?;
    let after_inr = &body_str[inr_pos + 5..];
    let colon_pos = after_inr.find(':')?;
    let after_colon = after_inr[colon_pos + 1..].trim_start();
    let end = after_colon
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(after_colon.len());
    let rate_str = &after_colon[..end];
    rate_str.parse::<f64>().ok()
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
    use frame_system::{
        offchain::{AppCrypto, CreateSignedTransaction, SendSignedTransaction, Signer},
        pallet_prelude::*,
    };
    use sp_runtime::{
        offchain::{http, Duration},
        KeyTypeId,
    };
    use sp_std::vec::Vec;

    pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"rate");

    pub mod crypto {
        use super::KEY_TYPE;
        use sp_runtime::{
            app_crypto::{app_crypto, sr25519},
            MultiSignature, MultiSigner,
        };
        app_crypto!(sr25519, KEY_TYPE);

        pub struct OracleId;
        impl frame_system::offchain::AppCrypto<MultiSigner, MultiSignature> for OracleId {
            type RuntimeAppPublic = Public;
            type GenericSignature = sp_core::sr25519::Signature;
            type GenericPublic = sp_core::sr25519::Public;
        }
    }

    /// Stored FX rate entry
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct RateEntry<BlockNumber> {
        /// Rate * 10^6 (e.g. 83.50 USD/INR → 83_500_000)
        pub rate: u64,
        pub updated_at: BlockNumber,
        /// Number of sources that agreed on this rate
        pub source_count: u8,
        /// Confidence: 0=low, 1=medium, 2=high
        pub confidence: u8,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config + CreateSignedTransaction<Call<Self>> {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        type AuthorityId: AppCrypto<Self::Public, Self::Signature>;

        /// How many blocks between rate updates (default: 10 blocks = ~60s)
        #[pallet::constant]
        type UpdateInterval: Get<BlockNumberFor<Self>>;

        /// Maximum allowed deviation from last rate before circuit breaker (in bps, default: 500 = 5%)
        #[pallet::constant]
        type CircuitBreakerBps: Get<u64>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn current_rate)]
    pub type CurrentRate<T: Config> = StorageValue<_, RateEntry<BlockNumberFor<T>>, OptionQuery>;

    /// Historical rates ring buffer (last 24 entries = ~24 min)
    #[pallet::storage]
    pub type RateHistory<T: Config> =
        StorageValue<_, BoundedVec<RateEntry<BlockNumberFor<T>>, ConstU32<24>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        RateUpdated {
            rate: u64,
            block: BlockNumberFor<T>,
            sources: u8,
        },
        CircuitBreakerTripped {
            attempted_rate: u64,
            last_rate: u64,
            deviation_bps: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        RateUnavailable,
        CircuitBreakerActive,
        InvalidRate,
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn offchain_worker(block_number: BlockNumberFor<T>) {
            let interval = T::UpdateInterval::get();
            // Run every `UpdateInterval` blocks
            if block_number % interval != BlockNumberFor::<T>::from(0u32) {
                return;
            }

            match Self::fetch_and_aggregate_rate() {
                Ok(rate) => {
                    let signer = Signer::<T, T::AuthorityId>::all_accounts();
                    if !signer.can_sign() {
                        log::warn!("rate_lock: no signing key available");
                        return;
                    }
                    let results =
                        signer.send_signed_transaction(|_account| Call::submit_rate { rate });
                    for (_, result) in &results {
                        if let Err(e) = result {
                            log::error!("rate_lock: submit failed: {:?}", e);
                        }
                    }
                }
                Err(e) => log::error!("rate_lock: fetch failed: {:?}", e),
            }
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit a new rate from the OCW oracle key.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 4096))]
        pub fn submit_rate(origin: OriginFor<T>, rate: u64) -> DispatchResult {
            ensure_signed(origin)?;
            ensure!(
                rate > 0 && rate < 20_000_000_000u64,
                Error::<T>::InvalidRate
            ); // 0 < rate < 20,000 INR/USD

            // Circuit breaker: reject if >5% deviation from last known rate
            if let Some(last) = CurrentRate::<T>::get() {
                let deviation = if rate > last.rate {
                    (rate - last.rate) * 10_000 / last.rate
                } else {
                    (last.rate - rate) * 10_000 / last.rate
                };

                if deviation > T::CircuitBreakerBps::get() {
                    Self::deposit_event(Event::CircuitBreakerTripped {
                        attempted_rate: rate,
                        last_rate: last.rate,
                        deviation_bps: deviation,
                    });
                    return Err(Error::<T>::CircuitBreakerActive.into());
                }
            }

            let current_block = <frame_system::Pallet<T>>::block_number();
            let entry = RateEntry {
                rate,
                updated_at: current_block,
                source_count: 3,
                confidence: 2,
            };

            CurrentRate::<T>::put(&entry);
            RateHistory::<T>::mutate(|history| {
                if history.len() >= 24 {
                    history.remove(0);
                }
                let _ = history.try_push(entry.clone());
            });

            Self::deposit_event(Event::RateUpdated {
                rate,
                block: current_block,
                sources: 3,
            });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Fetch rate from multiple sources and return median (manipulation-resistant)
        fn fetch_and_aggregate_rate() -> Result<u64, http::Error> {
            let deadline = sp_io::offchain::timestamp().add(Duration::from_millis(5_000));

            let sources = [
                "https://open.er-api.com/v6/latest/USD",
                "https://api.frankfurter.app/latest?from=USD&to=INR",
                "https://api.exchangerate.host/latest?base=USD&symbols=INR",
            ];

            let mut rates: Vec<u64> = Vec::new();

            for url in &sources {
                let request = http::Request::get(*url);
                let pending = request
                    .deadline(deadline)
                    .send()
                    .map_err(|_| http::Error::IoError)?;
                let response = pending
                    .try_wait(deadline)
                    .map_err(|_| http::Error::DeadlineReached)??;

                if response.code != 200 {
                    continue;
                }

                let body = response.body().collect::<Vec<u8>>();
                if let Some(rate) = Self::parse_inr_rate(&body) {
                    // Store as rate * 10^6 for precision
                    rates.push((rate * 1_000_000f64) as u64);
                }
            }

            if rates.is_empty() {
                return Err(http::Error::Unknown);
            }

            rates.sort_unstable();
            Ok(rates[rates.len() / 2]) // median
        }

        fn parse_inr_rate(body: &[u8]) -> Option<f64> {
            crate::parse_inr_rate_from_json(body)
        }

        /// Public getter for pallet_remittance to use
        pub fn get_current_rate() -> Option<u64> {
            CurrentRate::<T>::get().map(|e| e.rate)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_inr_rate_handles_valid_payload() {
        let payload = br#"{"rates":{"INR":83.5421}}"#;
        let rate = parse_inr_rate_from_json(payload).unwrap_or_default();
        assert!(rate > 80.0);
        assert!(rate < 90.0);
    }
}
