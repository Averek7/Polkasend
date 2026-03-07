//! # PolkaSend XCM Configuration
//!
//! XCM executor configuration for the PolkaSend parachain.
//! Defines asset filters, weight traders, origin converters, and
//! the trusted reserve asset relationship with AssetHub.

use frame_support::{
    parameter_types,
    traits::{ConstU32, Everything, Nothing},
};
use xcm::latest::prelude::*;
use xcm_builder::{
    AccountId32Aliases, AllowExplicitUnpaidExecutionFrom, AllowTopLevelPaidExecutionFrom,
    EnsureXcmOrigin, FixedWeightBounds, FungiblesAdapter, NoChecking,
    ParentIsPreset, RelayChainAsNative, SiblingParachainAsNative, SiblingParachainConvertsVia,
    SignedAccountId32AsNative, SignedToAccountId32, SovereignSignedViaLocation,
    TakeWeightCredit, UsingComponents,
};
use xcm_executor::XcmExecutor;

use crate::Runtime;

parameter_types! {
    pub const RelayNetwork: Option<NetworkId> = Some(NetworkId::Polkadot);
    pub RelayChainOrigin:   RuntimeOrigin = cumulus_pallet_xcm::Origin::Relay.into();
    pub UniversalLocation:  InteriorLocation = X2(GlobalConsensus(NetworkId::Polkadot), Parachain(3000));
    pub const MaxInstructions: u32 = 100;

    // AssetHub Para #1000 — our reserve for USDC/USDT
    pub AssetHubLocation: Location = Location::new(1, [Parachain(1000)]);
    // Acala Para #2000 — DeFi liquidity + iINR
    pub AcalaLocation:    Location = Location::new(1, [Parachain(2000)]);
}

/// Convert XCM origins to local AccountId for execution
pub type LocationToAccountId = (
    ParentIsPreset<crate::AccountId>,
    SiblingParachainConvertsVia<polkadot_parachain::primitives::Sibling, crate::AccountId>,
    AccountId32Aliases<RelayNetwork, crate::AccountId>,
);

/// XCM origin → local RuntimeOrigin converter
pub type XcmOriginToTransactDispatchOrigin = (
    SovereignSignedViaLocation<LocationToAccountId, RuntimeOrigin>,
    RelayChainAsNative<RelayChainOrigin, RuntimeOrigin>,
    SiblingParachainAsNative<cumulus_pallet_xcm::Origin, RuntimeOrigin>,
    SignedAccountId32AsNative<RelayNetwork, RuntimeOrigin>,
);

/// Handle the USDC / USDT multi-assets via pallet_assets
pub type FungiblesTransactor = FungiblesAdapter<
    // Use pallet_assets for multi-asset management
    crate::Assets,
    // Map XCM asset IDs to pallet_assets u32 IDs
    xcm_builder::ConvertedConcreteId<
        u32,
        crate::Balance,
        AsPrefixedGeneralIndex<AssetHubLocation, u32, JustTry>,
        JustTry,
    >,
    // Convert locations to accounts
    LocationToAccountId,
    crate::AccountId,
    NoChecking,
    CheckingAccount,
>;

parameter_types! {
    pub CheckingAccount: crate::AccountId = PolkadotXcm::check_account();
}

/// Weight trader — accept DOT and PST for execution fees
pub type Trader = UsingComponents<
    crate::WeightToFee,
    DotLocation,
    crate::AccountId,
    crate::Balances,
    (),
>;

parameter_types! {
    pub DotLocation: Location = Location::parent();
}

/// Barrier: only allow paid execution from trusted origins
pub type XcmBarrier = (
    TakeWeightCredit,
    AllowTopLevelPaidExecutionFrom<Everything>,
    AllowExplicitUnpaidExecutionFrom<ParentOrParentsExecutivePlural>,
);

pub type ParentOrParentsExecutivePlural = (
    xcm_builder::ParentOrParentsPlurality,
);

/// The XCM executor configuration
pub struct XcmConfig;

impl xcm_executor::Config for XcmConfig {
    type RuntimeCall         = crate::RuntimeCall;
    type XcmSender           = XcmRouter;
    type AssetTransactor     = FungiblesTransactor;
    type OriginConverter     = XcmOriginToTransactDispatchOrigin;
    type IsReserve           = xcm_builder::ReserveAssetFrom<AssetHubLocation>;
    type IsTeleporter        = Nothing;
    type UniversalLocation   = UniversalLocation;
    type Barrier             = XcmBarrier;
    type Weigher             = FixedWeightBounds<UnitWeightCost, crate::RuntimeCall, MaxInstructions>;
    type Trader              = Trader;
    type ResponseHandler     = PolkadotXcm;
    type AssetTrap           = PolkadotXcm;
    type AssetLocker         = ();
    type AssetExchanger      = ();
    type AssetClaims         = PolkadotXcm;
    type SubscriptionService = PolkadotXcm;
    type PalletInstancesInfo = crate::AllPalletsWithSystem;
    type MaxAssetsIntoHolding = ConstU32<8>;
    type FeeManager          = ();
    type MessageExporter     = ();
    type UniversalAliases    = Nothing;
    type CallDispatcher      = crate::RuntimeCall;
    type SafeCallFilter      = Everything;
    type Aliasers            = Nothing;
}

parameter_types! {
    pub const UnitWeightCost: Weight = Weight::from_parts(1_000_000, 64);
}

/// Route XCM messages via XCMP queue or upward message passing
pub type XcmRouter = (
    // Upward to relay chain
    cumulus_primitives_utility::ParentAsUmp<crate::ParachainSystem, PolkadotXcm, ()>,
    // Lateral to sibling parachains
    cumulus_pallet_xcmp_queue::Pallet<Runtime>,
);

/// Build XCM message to swap USDC → iINR on Acala
///
/// Called by pallet_remittance when DeliveryMode requires fiat settlement.
/// The swap result (iINR) triggers the fiat_bridge oracle.
pub fn build_acala_swap_xcm(
    usdc_amount:      u128,
    min_iinr_amount:  u128,
    callback_query_id: u64,
) -> Xcm<()> {
    Xcm(vec![
        // Transact on Acala: call Dex::swap_with_exact_supply
        Transact {
            origin_kind:             OriginKind::SovereignAccount,
            require_weight_at_most:  Weight::from_parts(2_000_000_000, 128 * 1024),
            call: encode_acala_swap_call(usdc_amount, min_iinr_amount).into(),
        },
        // Report result back to PolkaSend for callback processing
        ReportTransactStatus(QueryResponseInfo {
            destination: Location::new(1, [Parachain(3000)]),
            query_id:    callback_query_id,
            max_weight:  Weight::from_parts(500_000_000, 32 * 1024),
        }),
    ])
}

fn encode_acala_swap_call(_usdc_amount: u128, _min_iinr_amount: u128) -> sp_std::vec::Vec<u8> {
    // In production: SCALE-encode the Acala runtime call
    // acala_runtime::RuntimeCall::Dex(module_dex::Call::swap_with_exact_supply {
    //     path: vec![USDC_CURRENCY, IINR_CURRENCY],
    //     supply_amount: usdc_amount,
    //     min_target_amount: min_iinr_amount,
    // }).encode()
    sp_std::vec![]
}
