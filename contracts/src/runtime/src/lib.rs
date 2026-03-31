#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "256"]

use frame_support::{
    construct_runtime, derive_impl, parameter_types,
    traits::{AsEnsureOriginWithArg, Everything},
};
use parity_scale_codec::Encode;
use sp_runtime::{
    create_runtime_str, generic,
    traits::{AccountIdLookup, BlakeTwo256, IdentifyAccount, Verify},
    MultiAddress, MultiSignature,
};

pub type Signature = MultiSignature;
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;
pub type Address = MultiAddress<AccountId, ()>;
pub type Balance = u128;
pub type Nonce = u32;
pub type Hash = sp_core::H256;
pub type BlockNumber = u32;

pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

#[sp_version::runtime_version]
pub const VERSION: sp_version::RuntimeVersion = sp_version::RuntimeVersion {
    spec_name: create_runtime_str!("polkasend"),
    impl_name: create_runtime_str!("polkasend"),
    authoring_version: 1,
    spec_version: 1,
    impl_version: 1,
    apis: sp_version::create_apis_vec!([]),
    transaction_version: 1,
    state_version: 1,
};

parameter_types! {
    pub Version: sp_version::RuntimeVersion = VERSION;
    pub const BlockHashCount: BlockNumber = 256;
    pub const SS58Prefix: u16 = 42;
    pub const ExistentialDeposit: Balance = 1;
    pub const TreasuryAccount: AccountId = AccountId::new([0xfe; 32]);
    pub const ProtocolFeeBps: u64 = 50;
    pub const MinSendAmount: u128 = 1_000_000;
    pub const RateLockBlocks: BlockNumber = 150;
    pub const BasicKycLimitUsdCents: u64 = 250_000;
    pub const FullKycLimitUsdCents: u64 = 25_000_000;
    pub const BlocksPerYear: BlockNumber = 5_256_000;
    pub const RateUpdateInterval: BlockNumber = 10;
    pub const CircuitBreakerBps: u64 = 500;
    pub const AssetDeposit: Balance = 1;
    pub const AssetAccountDeposit: Balance = 10;
    pub const MetadataDepositBase: Balance = 1;
    pub const MetadataDepositPerByte: Balance = 1;
    pub const ApprovalDeposit: Balance = 1;
}

pub type SignedExtra = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
);

pub type UncheckedExtrinsic =
    generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, SignedExtra>;
pub type SignedPayload = generic::SignedPayload<RuntimeCall, SignedExtra>;

construct_runtime!(
    pub enum Runtime {
        System: frame_system,
        Balances: pallet_balances,
        Assets: pallet_assets,
        Kyc: pallet_kyc,
        RateLock: pallet_rate_lock,
        FiatBridge: pallet_fiat_bridge,
        Remittance: pallet_remittance,
    }
);

#[derive_impl(frame_system::config_preludes::SolochainDefaultConfig)]
impl frame_system::Config for Runtime {
    type Block = Block;
    type Nonce = Nonce;
    type Hash = Hash;
    type AccountId = AccountId;
    type Lookup = AccountIdLookup<AccountId, ()>;
    type BlockHashCount = BlockHashCount;
    type Version = Version;
    type AccountData = pallet_balances::AccountData<Balance>;
    type SS58Prefix = SS58Prefix;
    type BaseCallFilter = Everything;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Balance = Balance;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
}

#[derive_impl(pallet_assets::config_preludes::TestDefaultConfig)]
impl pallet_assets::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Balance = Balance;
    type Currency = Balances;
    type CreateOrigin = AsEnsureOriginWithArg<frame_system::EnsureSigned<AccountId>>;
    type ForceOrigin = frame_system::EnsureRoot<AccountId>;
    type AssetDeposit = AssetDeposit;
    type AssetAccountDeposit = AssetAccountDeposit;
    type MetadataDepositBase = MetadataDepositBase;
    type MetadataDepositPerByte = MetadataDepositPerByte;
    type ApprovalDeposit = ApprovalDeposit;
    type Freezer = ();
    type CallbackHandle = ();
}

impl pallet_kyc::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type KycAuthority = frame_system::EnsureRoot<AccountId>;
    type RevocationAuthority = frame_system::EnsureRoot<AccountId>;
    type BasicKycLimitUsdCents = BasicKycLimitUsdCents;
    type FullKycLimitUsdCents = FullKycLimitUsdCents;
    type BlocksPerYear = BlocksPerYear;
}

impl pallet_rate_lock::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type AuthorityId = pallet_rate_lock::pallet::crypto::OracleId;
    type UpdateInterval = RateUpdateInterval;
    type CircuitBreakerBps = CircuitBreakerBps;
}

impl pallet_fiat_bridge::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
}

pub struct RuntimeFxOracle;

impl pallet_remittance::FxRateProvider for RuntimeFxOracle {
    fn get_usdinr_rate() -> Option<u64> {
        pallet_rate_lock::CurrentRate::<Runtime>::get().map(|entry| entry.rate)
    }
}

impl pallet_remittance::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Assets = Assets;
    type TreasuryAccount = TreasuryAccount;
    type ProtocolFeeBps = ProtocolFeeBps;
    type MinSendAmount = MinSendAmount;
    type RateLockBlocks = RateLockBlocks;
    type FxOracle = RuntimeFxOracle;
}

impl<LocalCall> frame_system::offchain::CreateSignedTransaction<LocalCall> for Runtime
where
    RuntimeCall: From<LocalCall>,
{
    fn create_transaction<C: frame_system::offchain::AppCrypto<Self::Public, Self::Signature>>(
        call: RuntimeCall,
        public: <Signature as Verify>::Signer,
        _account: AccountId,
        nonce: Nonce,
    ) -> Option<(RuntimeCall, <UncheckedExtrinsic as sp_runtime::traits::Extrinsic>::SignaturePayload)>
    {
        let period = BlockHashCount::get().checked_next_power_of_two()?.saturating_div(2) as u64;
        let current_block = System::block_number().saturating_sub(1) as u64;
        let extra = (
            frame_system::CheckNonZeroSender::<Runtime>::new(),
            frame_system::CheckSpecVersion::<Runtime>::new(),
            frame_system::CheckTxVersion::<Runtime>::new(),
            frame_system::CheckGenesis::<Runtime>::new(),
            frame_system::CheckEra::<Runtime>::from(sp_runtime::generic::Era::mortal(
                period,
                current_block,
            )),
            frame_system::CheckNonce::<Runtime>::from(nonce),
            frame_system::CheckWeight::<Runtime>::new(),
        );
        let raw_payload = SignedPayload::new(call, extra).ok()?;
        let signature = raw_payload.using_encoded(|payload| C::sign(payload, public.clone()))?;
        let (call, extra, _) = raw_payload.deconstruct();
        Some((call, (Address::Id(public.into_account()), signature, extra)))
    }
}

impl frame_system::offchain::SigningTypes for Runtime {
    type Public = <Signature as Verify>::Signer;
    type Signature = Signature;
}

impl<C> frame_system::offchain::SendTransactionTypes<C> for Runtime
where
    RuntimeCall: From<C>,
{
    type Extrinsic = UncheckedExtrinsic;
    type OverarchingCall = RuntimeCall;
}
