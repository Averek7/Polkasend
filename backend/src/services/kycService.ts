import { logger } from '../config/logger';

export type KycLevel = 'NONE' | 'BASIC_KYC' | 'FULL_KYC' | 'INSTITUTIONAL';

export interface KycRecord {
  address: string;
  level: KycLevel;
  countryCode: string;
  annualLimitUsdCents: number;
  ytdSentUsdCents: number;
  approvedAt: Date;
  expiresAt: Date | null;
  aadhaarHashedRef?: string;  // SHA-256 of Aadhaar, stored off-chain; only ref kept here
  panHashedRef?: string;
}

// In-memory store (replace with encrypted DB)
const kycStore = new Map<string, KycRecord>();

const LIMITS: Record<KycLevel, number> = {
  NONE:            0,
  BASIC_KYC:       250_000,      // $2,500
  FULL_KYC:        25_000_000,   // $250,000 (RBI FEMA max)
  INSTITUTIONAL:   999_999_999,
};

export function getKycRecord(address: string): KycRecord | undefined {
  return kycStore.get(address.toLowerCase());
}

export function setKycRecord(address: string, level: KycLevel, countryCode: string): KycRecord {
  const record: KycRecord = {
    address: address.toLowerCase(),
    level,
    countryCode,
    annualLimitUsdCents: LIMITS[level],
    ytdSentUsdCents: 0,
    approvedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  };
  kycStore.set(address.toLowerCase(), record);
  logger.info(`KYC approved: ${address} → ${level}`);
  return record;
}

export function checkAndUpdateLimit(
  address: string,
  amountUsdCents: number
): { ok: boolean; reason?: string } {
  const record = kycStore.get(address.toLowerCase());
  if (!record || record.level === 'NONE') {
    return { ok: false, reason: 'KYC_REQUIRED' };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return { ok: false, reason: 'KYC_EXPIRED' };
  }
  if (record.ytdSentUsdCents + amountUsdCents > record.annualLimitUsdCents) {
    return { ok: false, reason: 'ANNUAL_LIMIT_EXCEEDED' };
  }
  record.ytdSentUsdCents += amountUsdCents;
  return { ok: true };
}

// ─── AML screening (stub — integrate OFAC/FIU-IND in production) ──
const SANCTIONED_ADDRESSES = new Set<string>([
  // Placeholder — production would query OFAC SDN list
]);

export function amlScreen(address: string): { pass: boolean; reason?: string } {
  if (SANCTIONED_ADDRESSES.has(address.toLowerCase())) {
    logger.warn(`AML hit: ${address}`);
    return { pass: false, reason: 'SANCTIONS_LIST_MATCH' };
  }
  return { pass: true };
}
