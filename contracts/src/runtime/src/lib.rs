//! # PolkaSend Runtime
//!
//! Parachain runtime for PolkaSend (Para ID #3000).
//! Assembled using `construct_runtime!` macro with all custom pallets.

#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "256"]

extern crate alloc;

use frame_support::{
    construct_runtime, parameter_types,
    traits::{ConstU32, ConstU64, Everything, Nothing},
    weights::IdentityFee,
};
use frame_system::limits::{BlockLength, BlockWeights};
use sp_runtime::{
    create_runtime_str, generic, impl_opaque_keys,
    traits::{AccountIdLookup, BlakeTwo256, Block as BlockT},
    transaction_validity::{TransactionSource, TransactionValidity},
    ApplyExtrinsicResult, MultiAddress,
};
use sp_std::prelude::*;
use xcm::latest::prelude::*;
use xcm_builder::{
    AccountId32Aliases, AllowTopLevelPaidExecutionFrom,
    EnsureXcmOrigin, FixedWeightBounds, ParentIsPreset,
    RelayChainAsNative, SiblingParachainAsNative, SiblingParachainConvertsVia,
    SignedAccountId32AsNative, SignedToAccountId32, SovereignSignedViaLocation,
};

pub type AccountId = sp_runtime::AccountId32;
pub type Balance = u128;
pub type BlockNumber = u32;
pub type Hash = sp_core::H256;
pub type Nonce = u32;

pub mod opaque {
    use super::*;
    pub use sp_runtime::OpaqueExtrinsic as UncheckedExtrinsic;
    pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
    pub type Block = generic::Block<Header, UncheckedExtrinsic>;
    pub type BlockId = generic::BlockId<Block>;
}

// ─── Runtime version ─────────────────────────────────────────────────────────

#[sp_version::runtime_version]
pub const VERSION: sp_version::RuntimeVersion = sp_version::RuntimeVersion {
    spec_name: create_runtime_str!("polkasend"),
    impl_name: create_runtime_str!("polkasend"),
    authoring_version: 1,
    spec_version: 1000,
    impl_version: 0,
    apis: sp_version::create_apis_vec!([]),
    transaction_version: 1,
    system_version: 1,
};

// ─── Parameters ──────────────────────────────────────────────────────────────

parameter_types! {
    pub const BlockHashCount: BlockNumber = 4096;
    pub const Version: sp_version::RuntimeVersion = VERSION;

    // PolkaSend-specific
    pub const ProtocolFeeBps: u64 = 50;             // 0.5%
    pub const MinSendAmount: u128 = 1_000_000;      // $1 USDC min
    pub const RateLockBlocks: u32 = 150;            // ~15 min at 6s/block
    pub const BasicKycLimitUsdCents: u64 = 250_000; // $2,500/year
    pub const FullKycLimitUsdCents: u64 = 25_000_000; // $250,000/year
    pub const BlocksPerYear: u32 = 5_256_000;       // 365.25 days * 86400 / 6
    pub const RateUpdateInterval: u32 = 10;         // ~60s
    pub const CircuitBreakerBps: u64 = 500;         // 5% max deviation

    // PolkaSend treasury sovereign account
    pub TreasuryAccount: AccountId = AccountId::from([0xfe; 32]);

    // Parachain IDs
    pub const PolkaSendParaId: u32 = 3000;
    pub const AcalaParaId: u32 = 2000;
    pub const AssetHubParaId: u32 = 1000;
    pub const MoonbeamParaId: u32 = 2004;
}

// ─── construct_runtime! ───────────────────────────────────────────────────────
//
// This is the complete runtime composition for the PolkaSend parachain.
// Each pallet is assigned a unique index for SCALE encoding of extrinsics.

construct_runtime!(
    pub enum Runtime where
        Block = opaque::Block,
        NodeBlock = opaque::Block,
        UncheckedExtrinsic = opaque::UncheckedExtrinsic,
    {
        // ── Core system (0–9) ─────────────────────────────────────────────────
        System:             frame_system                         = 0,
        Timestamp:          pallet_timestamp                     = 1,
        ParachainSystem:    cumulus_pallet_parachain_system      = 2,
        ParachainInfo:      parachain_info                       = 3,

        // ── Consensus / collator selection (4–9) ─────────────────────────────
        Aura:               pallet_aura                          = 4,
        AuraExt:            cumulus_pallet_aura_ext              = 5,
        CollatorSelection:  pallet_collator_selection            = 6,
        Session:            pallet_session                       = 7,

        // ── Balances & fees (10–19) ───────────────────────────────────────────
        Balances:           pallet_balances                      = 10,
        TransactionPayment: pallet_transaction_payment           = 11,
        Assets:             pallet_assets                        = 12,   // USDC, USDT, iINR

        // ── XCM / cross-chain (20–29) ─────────────────────────────────────────
        XcmpQueue:          cumulus_pallet_xcmp_queue            = 20,
        PolkadotXcm:        pallet_xcm                           = 21,
        CumulusXcm:         cumulus_pallet_xcm                   = 22,
        DmpQueue:           cumulus_pallet_dmp_queue             = 23,
        MessageQueue:       pallet_message_queue                 = 24,

        // ── PolkaSend custom pallets (30–39) ──────────────────────────────────
        Kyc:                pallet_kyc                           = 30,
        Remittance:         pallet_remittance                    = 31,
        RateLock:           pallet_rate_lock                     = 32,
        FiatBridge:         pallet_fiat_bridge                   = 33,
        // LiquidityPool (iINR minting/burning) — Phase 2
        // ComplianceLimits (on-chain governance of FEMA thresholds) — Phase 2

        // ── Governance (40–49) ────────────────────────────────────────────────
        Treasury:           pallet_treasury                      = 40,
        Democracy:          pallet_democracy                     = 41,
        Council:            pallet_collective::<Instance1>       = 42,
        TechnicalCommittee: pallet_collective::<Instance2>       = 43,

        // ── Utilities (50–59) ─────────────────────────────────────────────────
        Utility:            pallet_utility                       = 50,
        Multisig:           pallet_multisig                      = 51,
        Proxy:              pallet_proxy                         = 52,
    }
);

// ─── Asset IDs ────────────────────────────────────────────────────────────────

pub mod asset_ids {
    /// USDC (via AssetHub)
    pub const USDC: u32 = 1337;
    /// USDT (via AssetHub)
    pub const USDT: u32 = 1984;
    /// DAI (via Moonbeam bridge)
    pub const DAI: u32 = 1338;
    /// iINR — PolkaSend's native INR stablecoin
    pub const IINR: u32 = 9000;
    /// PST — PolkaSend protocol token
    pub const PST: u32 = 9001;
}

// ─── XCM Config ──────────────────────────────────────────────────────────────

pub struct XcmConfig;

impl xcm_executor::Config for XcmConfig {
    type RuntimeCall = RuntimeCall;
    type XcmSender = XcmRouter;
    type AssetTransactor = (); // configured with AssetHub reserve transfer
    type OriginConverter = XcmOriginToTransactDispatchOrigin;
    type IsReserve = Everything;
    type IsTeleporter = Nothing;
    type UniversalLocation = UniversalLocation;
    type Barrier = Barrier;
    type Weigher = FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;
    type Trader = (); // PST as fee token — configured in full runtime
    type ResponseHandler = PolkadotXcm;
    type AssetTrap = PolkadotXcm;
    type AssetLocker = ();
    type AssetExchanger = ();
    type AssetClaims = PolkadotXcm;
    type SubscriptionService = PolkadotXcm;
    type PalletInstancesInfo = AllPalletsWithSystem;
    type MaxAssetsIntoHolding = ConstU32<8>;
    type FeeManager = ();
    type MessageExporter = ();
    type UniversalAliases = Nothing;
    type CallDispatcher = RuntimeCall;
    type SafeCallFilter = Everything;
    type Aliasers = Nothing;
}

parameter_types! {
    pub const UnitWeightCost: u64 = 1_000_000;
    pub const MaxInstructions: u32 = 100;
    pub UniversalLocation: xcm::latest::InteriorLocation =
        xcm::latest::Junctions::X2([
            xcm::latest::Junction::GlobalConsensus(xcm::latest::NetworkId::Polkadot),
            xcm::latest::Junction::Parachain(3000),
        ].into());
}

// Type aliases for XCM origin conversion
pub type XcmOriginToTransactDispatchOrigin = (
    SovereignSignedViaLocation<LocationToAccountId, RuntimeOrigin>,
    RelayChainAsNative<RelayChainOrigin, RuntimeOrigin>,
    SiblingParachainAsNative<cumulus_pallet_xcm::Origin, RuntimeOrigin>,
    SignedAccountId32AsNative<RelayNetwork, RuntimeOrigin>,
);

parameter_types! {
    pub RelayNetwork: Option<xcm::latest::NetworkId> = Some(xcm::latest::NetworkId::Polkadot);
    pub RelayChainOrigin: RuntimeOrigin = cumulus_pallet_xcm::Origin::Relay.into();
}

pub type LocationToAccountId = (
    ParentIsPreset<AccountId>,
    SiblingParachainConvertsVia<polkadot_parachain_primitives::primitives::Sibling, AccountId>,
    AccountId32Aliases<RelayNetwork, AccountId>,
);

pub type Barrier = AllowTopLevelPaidExecutionFrom<Everything>;
pub type XcmRouter = cumulus_primitives_utility::ParentAsUmp<ParachainSystem, PolkadotXcm, ()>;
