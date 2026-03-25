import { logger } from '../config/logger';
import { kycRepository } from '../repositories/kycRepository';

export type KycLevel = 'NONE' | 'BASIC_KYC' | 'FULL_KYC' | 'INSTITUTIONAL';

export interface KycRecord {
  address: string;
  level: KycLevel;
  countryCode: string;
  annualLimitUsdCents: number;
  ytdSentUsdCents: number;
  approvedAt: Date;
  expiresAt: Date | null;
  aadhaarHashedRef?: string;
  panHashedRef?: string;
}

const LIMITS: Record<KycLevel, number> = {
  NONE: 0,
  BASIC_KYC: 250_000,
  FULL_KYC: 25_000_000,
  INSTITUTIONAL: 999_999_999,
};

export async function getKycRecord(address: string): Promise<KycRecord | undefined> {
  return kycRepository.findByAddress(address);
}

export async function setKycRecord(address: string, level: KycLevel, countryCode: string): Promise<KycRecord> {
  const record: KycRecord = {
    address: address.toLowerCase(),
    level,
    countryCode,
    annualLimitUsdCents: LIMITS[level],
    ytdSentUsdCents: 0,
    approvedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };

  await kycRepository.save(record);
  logger.info(`KYC approved: ${address} -> ${level}`);
  return record;
}

export async function checkAndUpdateLimit(
  address: string,
  amountUsdCents: number,
): Promise<{ ok: boolean; reason?: string }> {
  const record = await kycRepository.findByAddress(address);
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
  await kycRepository.save(record);
  return { ok: true };
}

const SANCTIONED_ADDRESSES = new Set<string>([]);

export function amlScreen(address: string): { pass: boolean; reason?: string } {
  if (SANCTIONED_ADDRESSES.has(address.toLowerCase())) {
    logger.warn(`AML hit: ${address}`);
    return { pass: false, reason: 'SANCTIONS_LIST_MATCH' };
  }
  return { pass: true };
}
