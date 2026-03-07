# PolkaSend — Substrate FRAME Pallets & Contracts

This directory contains the on-chain logic for the PolkaSend parachain.

## Structure

```
contracts/
├── pallets/
│   ├── pallet_kyc/              # KYC/AML identity & compliance
│   ├── pallet_remittance/       # Core remittance logic & escrow
│   ├── pallet_rate_lock/        # FX oracle + 15-min rate lock (OCW)
│   ├── pallet_liquidity_pool/   # iINR liquidity management
│   └── pallet_fiat_bridge/      # UPI/IMPS oracle settlement
├── xcm/
│   ├── xcm_config.rs            # XCM executor & barrier config
│   ├── xcm_messages.rs          # XCM message constructors
│   └── asset_transactors.rs     # Asset handling for XCM
└── interfaces/
    ├── IFxOracle.ts             # TypeScript oracle interface
    └── pallet_types.ts          # Shared TypeScript types
```

## Pallet Dependency Graph

```
pallet_remittance
    ├── pallet_kyc          (compliance gate)
    ├── pallet_rate_lock    (FX price lock)
    ├── pallet_liquidity_pool (iINR swap)
    └── pallet_fiat_bridge  (UPI settlement)
```

## Build & Test

```bash
# Build the runtime
cargo build --release -p polkasend-runtime

# Run pallet unit tests
cargo test -p pallet-kyc
cargo test -p pallet-remittance
cargo test -p pallet-rate-lock

# Benchmark pallets
cargo test -p pallet-remittance --features runtime-benchmarks
```

## Deployment

```bash
# Launch local dev node
./target/release/polkasend-node --dev

# Connect to Paseo testnet as parachain
./target/release/polkasend-node \
  --chain paseo \
  --parachain-id 3000 \
  --rpc-port 9944
```
