# PolkaSend 🔴

> Cross-border remittance to India via Polkadot parachain. Under 0.5% fee. ~36 second settlement.

[![Polkadot](https://img.shields.io/badge/Polkadot-Parachain%20%233000-E6007A)](https://polkadot.network)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Substrate](https://img.shields.io/badge/Substrate-FRAME-6c9fff)](https://substrate.io)
[![XCM](https://img.shields.io/badge/XCM-v4-00e887)](https://wiki.polkadot.network/docs/learn-xcm)

---

## Overview

PolkaSend is a purpose-built Polkadot parachain for cross-border remittance to India. It reduces fees from the industry average of 4–8% down to **0.5%**, with end-to-end settlement in ~36 seconds via UPI.

### Key Numbers
| Metric | PolkaSend | Traditional Bank |
|--------|-----------|-----------------|
| Fee | **0.5%** | 4–8% |
| Settlement | **~36 seconds** | 1–3 days |
| FX spread | **0%** | 1–2% |
| Transparency | **Full on-chain** | Opaque |

---

## Architecture

```
Frontend (Next.js 14)
    ↕ REST + WebSocket
Backend (Express.js)
    ↕ Polkadot.js API
PolkaSend Parachain #3000 (Substrate)
    ├── pallet_kyc          — KYC/AML, Aadhaar, FEMA limits
    ├── pallet_remittance   — Core escrow + routing
    ├── pallet_rate_lock    — FX oracle + lock (OCW)
    ├── pallet_liquidity_pool — iINR stablecoin pool
    └── pallet_fiat_bridge  — UPI/IMPS oracle
    ↕ XCM v4
Acala Para #2000 (DEX + iINR liquidity)
AssetHub Para #1000 (USDC/USDT reserve)
Moonbeam Para #2004 (EVM entry point)
    ↕ Oracle API
UPI / IMPS / NEFT (India settlement)
```

---

## Project Structure

```
polkasend/
├── app/                    # Next.js 14 App Router
│   ├── page.tsx            # Landing page
│   ├── send/               # Remittance dApp
│   ├── track/              # Order tracking
│   ├── architecture/       # Protocol visualizer
│   ├── dashboard/          # Analytics
│   └── api/                # Next.js API routes
│       ├── remittance/     # Order management
│       ├── kyc/            # KYC endpoints
│       ├── rates/          # FX rate oracle
│       └── transactions/   # Tx history
├── components/
│   ├── logo/               # Animated PolkaSend logo
│   ├── layout/             # Navbar, Footer
│   └── remittance/         # SendForm, FeeBreakdown, etc.
├── lib/
│   └── polkadot/           # API client, wallet store, remittance store
├── contracts/
│   ├── pallets/            # Substrate FRAME pallet source (Rust)
│   ├── xcm/                # XCM config & message builders
│   └── interfaces/         # TypeScript types for pallets
├── backend/
│   ├── server.js           # Express API server
│   ├── routes/             # REST endpoints
│   ├── services/           # Business logic
│   ├── middleware/         # Auth, rate limiting
│   └── models/             # Mongoose schemas
├── styles/
│   └── globals.css
├── types/
├── hooks/
└── public/
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (optional, falls back to in-memory)
- Polkadot.js browser extension (optional for demo mode)

### Install

```bash
npm install
```

### Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### Development

```bash
# Frontend only
npm run dev

# Backend only
npm run backend:dev

# Both together
npm run dev:integrated
```

Updated integrated scripts:

```bash
# Frontend + backend (single command)
npm run dev:integrated

# Build backend + frontend
npm run build:all

# Local docker deployment
npm run deploy:local
```

Frontend: http://localhost:3000  
Backend API: http://localhost:4000

---

## Custom Pallets

All Substrate FRAME pallets are in `contracts/pallets/`:

| Pallet | Purpose |
|--------|---------|
| `pallet_kyc` | KYC/AML — stores hashed Aadhaar/PAN, enforces FEMA annual limits |
| `pallet_remittance` | Core escrow, FX rate lock, order lifecycle |
| `pallet_rate_lock` | Off-chain worker fetches USD/INR from 3 oracles, stores median |
| `pallet_liquidity_pool` | iINR stablecoin pool, LP incentives |
| `pallet_fiat_bridge` | UPI/IMPS oracle — triggers fiat payment, captures UTR |

---

## XCM Flow

```
1. User → Moonbeam: approve USDC spend
2. Moonbeam → Relay Chain: XCM ReserveTransfer
3. Relay Chain → PolkaSend Para #3000: XCMP delivery
4. PolkaSend: pallet_kyc check + pallet_rate_lock
5. PolkaSend → Acala: XCM Transact (USDC→iINR swap)
6. PolkaSend: pallet_fiat_bridge → UPI payment
7. UPI Oracle → PolkaSend: confirm_settlement(utr_number)
8. Order status: Completed ✓
```

---

## License

MIT — Built for the Polkadot ecosystem.
