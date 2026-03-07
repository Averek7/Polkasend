// contracts/xcm/xcm_config.rs
//
// XCM executor configuration for the PolkaSend parachain.
// Defines barriers, asset transactors, weight traders and more.

use frame_support::{
    match_types, parameter_types,
    traits::{Everything, Nothing},
};
use xcm::latest::prelude::*;
use xcm_builder::{
    AccountId32Aliases, AllowExplicitUnpaidExecutionFrom,
    AllowSubscriptionsFrom, AllowTopLevelPaidExecutionFrom,
    AllowKnownQueryResponses, FixedWeightBounds,
    FungiblesAdapter, NoChecking, ParentIsPreset,
    RelayChainAsNative, SiblingParachainAsNative,
    SiblingParachainConvertsVia, SignedAccountId32AsNative,
    SignedToAccountId32, SovereignSignedViaLocation,
    TakeWeightCredit, WithComputedOrigin,
};
use xcm_executor::XcmExecutor;

use crate::{
    AccountId, Balance, Balances, Runtime, RuntimeCall,
    RuntimeEvent, RuntimeOrigin, WeightToFee, XcmpQueue,
};

parameter_types! {
    pub const RelayLocation: Location = Location::parent();
    pub const RelayNetwork: Option<NetworkId> = Some(NetworkId::Polkadot);

    pub RelayChainOrigin: RuntimeOrigin =
        cumulus_pallet_xcm::Origin::Relay.into();

    pub UniversalLocation: InteriorLocation =
        X2([GlobalConsensus(NetworkId::Polkadot), Parachain(3000)].into());

    // Trusted sibling parachains for XCM
    pub AcalaLocation: Location =
        Location::new(1, [Parachain(2000)].into());
    pub AssetHubLocation: Location =
        Location::new(1, [Parachain(1000)].into());
    pub MoonbeamLocation: Location =
        Location::new(1, [Parachain(2004)].into());

    pub const MaxInstructions: u32 = 100;
    pub const MaxAssetsIntoHolding: u32 = 64;
}

/// Which parachains/accounts can teleport assets (none — we use reserve transfers)
pub type TeleportFilter = Nothing;

/// Trusted reserve locations
match_types! {
    pub type TrustedReserves: impl Contains<Location> = {
        Location { parents: 1, interior: Here }        // Relay chain
        | Location { parents: 1, interior: X1([Parachain(1000)].into()) } // AssetHub
        | Location { parents: 1, interior: X1([Parachain(2000)].into()) } // Acala
    };
}

/// Convert locations to AccountIds
pub type LocationToAccountId = (
    ParentIsPreset<AccountId>,
    SiblingParachainConvertsVia<polkadot_parachain::primitives::Sibling, AccountId>,
    AccountId32Aliases<RelayNetwork, AccountId>,
);

/// Asset transactors — handle native DOT + fungible assets (USDC, USDT, iINR)
pub type LocalAssetTransactor = FungiblesAdapter<
    Assets,
    ConvertedConcreteId<
        AssetId,
        Balance,
        AsPrefixedGeneralIndex<AssetHubLocation, AssetId, JustTry>,
        JustTry,
    >,
    LocationToAccountId,
    AccountId,
    NoChecking,
    CheckingAccount,
>;

/// Who can execute XCM messages without paying weight
pub type XcmBarrier = (
    TakeWeightCredit,
    AllowTopLevelPaidExecutionFrom<Everything>,
    AllowKnownQueryResponses<PolkadotXcm>,
    WithComputedOrigin<
        (
            AllowExplicitUnpaidExecutionFrom<ParentLocation>,
            AllowSubscriptionsFrom<ParentOrSiblings>,
        ),
        UniversalLocation,
        ConstU32<8>,
    >,
);

pub struct XcmConfig;
impl xcm_executor::Config for XcmConfig {
    type RuntimeCall        = RuntimeCall;
    type XcmSender          = XcmRouter;
    type AssetTransactor    = LocalAssetTransactor;
    type OriginConverter    = XcmOriginToTransactDispatchOrigin;
    type IsReserve          = TrustedReserves;
    type IsTeleporter       = TeleportFilter;
    type UniversalLocation  = UniversalLocation;
    type Barrier            = XcmBarrier;
    type Weigher            = FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;
    type Trader             = UsingComponents<WeightToFee, RelayLocation, AccountId, Balances, ToAuthor<Runtime>>;
    type ResponseHandler    = PolkadotXcm;
    type AssetTrap          = PolkadotXcm;
    type AssetClaims        = PolkadotXcm;
    type SubscriptionService = PolkadotXcm;
    type PalletInstancesInfo = AllPalletsWithSystem;
    type MaxAssetsIntoHolding = MaxAssetsIntoHolding;
    type AssetLocker        = ();
    type AssetExchanger     = ();
    type FeeManager         = ();
    type MessageExporter    = ();
    type UniversalAliases   = Nothing;
    type CallDispatcher     = RuntimeCall;
    type SafeCallFilter      = Everything;
    type Aliasers           = Nothing;
}
