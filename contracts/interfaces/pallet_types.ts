// contracts/interfaces/pallet_types.ts
// TypeScript type definitions mirroring Substrate FRAME pallet types

export type AccountId = string; // SS58 format

// ─── pallet_kyc ─────────────────────────────────────────────────────────────

export type KycLevel =
  | 'None'
  | 'BasicKyc'          // Up to $2,500/year — Aadhaar OTP only
  | 'FullKyc'           // Up to $250,000/year — PAN + Aadhaar + address
  | 'InstitutionalKyc'; // Corporate / AD-I level — unlimited

export interface KycRecord {
  account: AccountId;
  level: KycLevel;
  countryCode: string;           // ISO 3166-1 alpha-2
  aadhaarHash: string | null;    // SHA3-256, NOT raw
  panHash: string | null;
  approvedAt: number;            // Block number
  expiresAt: number | null;
  annualLimitUsdCents: number;
  ytdSentUsdCents: number;
}

// ─── pallet_remittance ───────────────────────────────────────────────────────

export type DeliveryMode =
  | { type: 'CryptoWallet' }
  | { type: 'UpiInstant';    upiId: string }
  | { type: 'BankTransfer';  ifsc: string; accountNumber: string }
  | { type: 'AadhaarPay';    aadhaarNumber: string }; // hashed before storage

export type RemittanceStatus =
  | 'Initiated'
  | 'RateLocked'
  | 'CompliancePassed'
  | 'SettlementTriggered'
  | { Completed: { utrNumber: string } }
  | { Failed:    { reason: string } };

export interface RemittanceOrder {
  id: string;                          // 0x hex, Blake2-256
  sender: AccountId;
  recipient: AccountId;
  assetId: number;                     // 1 = USDC, 2 = USDT, 3 = DAI
  amountIn: bigint;                    // in stablecoin base units (6 dec)
  amountOutInrPaise: bigint;           // 1 INR = 100 paise
  fxRateLocked: number;                // rate * 10^6
  feePaise: bigint;
  deliveryMode: DeliveryMode;
  status: RemittanceStatus;
  createdAt: number;                   // block number
  expiresAt: number;                   // block number
}

// ─── pallet_rate_lock ────────────────────────────────────────────────────────

export interface FxRate {
  pair: 'USD/INR';
  rate: number;          // rate * 10^6 on-chain
  rateDisplay: number;   // human-readable (e.g. 83.50)
  source1: number;
  source2: number;
  source3: number;
  median: number;
  updatedAtBlock: number;
  expiresAtBlock: number;
}

// ─── pallet_liquidity_pool ───────────────────────────────────────────────────

export interface PoolState {
  totalUsdcLiquidity: bigint;
  totalIinrLiquidity: bigint;
  currentPriceIinr: number;     // USDC per iINR
  lpTokenSupply: bigint;
  feePct: number;               // e.g. 0.3 for Uniswap-style 0.3%
}

// ─── XCM ─────────────────────────────────────────────────────────────────────

export const PARA_IDS = {
  polkaSend: 3000,
  acala:     2000,
  assetHub:  1000,
  moonbeam:  2004,
} as const;

export const ASSET_IDS = {
  USDC: 1,
  USDT: 1984,
  DAI:  3,
  iINR: 100,
  PST:  0,   // native
} as const;

export type AssetName = keyof typeof ASSET_IDS;

// ─── API response types ──────────────────────────────────────────────────────

export interface InitiateRemittanceResponse {
  success: boolean;
  orderId: string;
  txHash: string;
  fxRateLocked: number;
  amountInr: number;
  feePct: number;
  estimatedSettlement: string;
  status: RemittanceStatus;
}

export interface OrderStatusResponse extends RemittanceOrder {
  utrNumber?: string;
  completedAt?: string;
}
