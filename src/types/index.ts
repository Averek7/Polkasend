// ─── Wallet & Identity ───────────────────────────────────────────────────────

export type WalletType = "polkadot-js" | "talisman" | "subwallet" | "metamask";

export interface WalletAccount {
  address: string;
  name?: string;
  source: WalletType;
  type?: "sr25519" | "ed25519" | "ecdsa";
}

export enum KycLevel {
  None = "NONE",
  Basic = "BASIC_KYC",
  Full = "FULL_KYC",
  Institutional = "INSTITUTIONAL_KYC",
}

export interface KycRecord {
  accountId: string;
  level: KycLevel;
  approvedAt: number; // block number
  expiresAt: number | null;
  annualLimitUsdCents: number;
  ytdSentUsdCents: number;
  countryCode: string;
}

// ─── Remittance ───────────────────────────────────────────────────────────────

export type DeliveryMode = "UPI_INSTANT" | "IMPS_NEFT" | "IINR_WALLET" | "AADHAAR_PAY";

export type RemittanceStatus =
  | "INITIATED"
  | "RATE_LOCKED"
  | "COMPLIANCE_PASSED"
  | "SETTLEMENT_TRIGGERED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type SupportedAsset = "USDC" | "USDT" | "DAI";

export interface RemittanceOrder {
  id: string; // 0x hex
  sender: string;
  recipient: string;
  assetId: SupportedAsset;
  amountIn: bigint; // in micro-units (6 decimals)
  amountOutInrPaise: bigint;
  fxRateLocked: number; // * 10^6
  feePaise: bigint;
  deliveryMode: DeliveryMode;
  status: RemittanceStatus;
  createdAt: number; // block
  expiresAt: number; // block
  utrNumber?: string;
  failureReason?: string;
}

export interface RemittanceQuote {
  sendAmount: number; // USD
  receiveAmountInr: number;
  fxRate: number;
  feeUsd: number;
  feePct: number;
  gasEstimateUsd: number;
  totalCostUsd: number;
  estimatedTimeSeconds: number;
  validUntil: Date;
}

// ─── FX / Oracle ─────────────────────────────────────────────────────────────

export interface FxRate {
  pair: string; // e.g. "USD/INR"
  rate: number;
  source: string;
  timestamp: Date;
  confidence: "high" | "medium" | "low";
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Chain ────────────────────────────────────────────────────────────────────

export interface ChainStatus {
  relayBlock: number;
  paraBlock: number;
  activeValidators: number;
  totalValidators: number;
  fxRate: number;
  liquidityPoolUsd: number;
  isHealthy: boolean;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

export interface Corridor {
  from: string;
  fromFlag: string;
  to: string;
  toFlag: string;
  asset: SupportedAsset;
  avgDailyVolume: number;
}

export interface TransactionFeedItem {
  id: string;
  corridor: string;
  amountUsdc: number;
  amountInr: number;
  status: "completed" | "pending" | "processing";
  blockNumber: number;
  txHash: string;
  timestamp: Date;
}
