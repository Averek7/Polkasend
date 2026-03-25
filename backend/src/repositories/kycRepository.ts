import { prisma } from '../lib/prisma';
import { readCollection, writeCollection } from './fileStore';
import type { KycRecord } from '../services/kycService';

const STORAGE_FILE = 'kyc-records.json';

type StoredKycRecord = Omit<KycRecord, 'approvedAt' | 'expiresAt'> & {
  approvedAt: string;
  expiresAt: string | null;
};

export interface KycRepository {
  save(record: KycRecord): Promise<KycRecord>;
  findByAddress(address: string): Promise<KycRecord | undefined>;
  listAll(): Promise<KycRecord[]>;
}

function serialize(record: KycRecord): StoredKycRecord {
  return {
    ...record,
    approvedAt: record.approvedAt.toISOString(),
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
  };
}

function deserialize(record: StoredKycRecord): KycRecord {
  return {
    ...record,
    approvedAt: new Date(record.approvedAt),
    expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
  };
}

function fromPrismaRecord(record: {
  address: string;
  level: string;
  countryCode: string;
  annualLimitUsdCents: bigint;
  ytdSentUsdCents: bigint;
  approvedAt: Date;
  expiresAt: Date | null;
  aadhaarHashedRef: string | null;
  panHashedRef: string | null;
}): KycRecord {
  return {
    address: record.address,
    level: record.level as KycRecord['level'],
    countryCode: record.countryCode,
    annualLimitUsdCents: Number(record.annualLimitUsdCents),
    ytdSentUsdCents: Number(record.ytdSentUsdCents),
    approvedAt: record.approvedAt,
    expiresAt: record.expiresAt,
    aadhaarHashedRef: record.aadhaarHashedRef ?? undefined,
    panHashedRef: record.panHashedRef ?? undefined,
  };
}

class FileBackedKycRepository implements KycRepository {
  private records = new Map<string, KycRecord>();

  constructor() {
    for (const row of readCollection<StoredKycRecord>(STORAGE_FILE)) {
      const record = deserialize(row);
      this.records.set(record.address.toLowerCase(), record);
    }
  }

  async save(record: KycRecord): Promise<KycRecord> {
    this.records.set(record.address.toLowerCase(), record);
    this.flush();
    return record;
  }

  async findByAddress(address: string): Promise<KycRecord | undefined> {
    return this.records.get(address.toLowerCase());
  }

  async listAll(): Promise<KycRecord[]> {
    return Array.from(this.records.values());
  }

  private flush() {
    writeCollection(
      STORAGE_FILE,
      Array.from(this.records.values()).map(serialize),
    );
  }
}

class PrismaKycRepository implements KycRepository {
  async save(record: KycRecord): Promise<KycRecord> {
    const saved = await prisma.kycRecord.upsert({
      where: { address: record.address.toLowerCase() },
      create: {
        address: record.address.toLowerCase(),
        level: record.level,
        countryCode: record.countryCode,
        annualLimitUsdCents: BigInt(record.annualLimitUsdCents),
        ytdSentUsdCents: BigInt(record.ytdSentUsdCents),
        approvedAt: record.approvedAt,
        expiresAt: record.expiresAt,
        aadhaarHashedRef: record.aadhaarHashedRef ?? null,
        panHashedRef: record.panHashedRef ?? null,
      },
      update: {
        level: record.level,
        countryCode: record.countryCode,
        annualLimitUsdCents: BigInt(record.annualLimitUsdCents),
        ytdSentUsdCents: BigInt(record.ytdSentUsdCents),
        approvedAt: record.approvedAt,
        expiresAt: record.expiresAt,
        aadhaarHashedRef: record.aadhaarHashedRef ?? null,
        panHashedRef: record.panHashedRef ?? null,
      },
    });

    return fromPrismaRecord(saved);
  }

  async findByAddress(address: string): Promise<KycRecord | undefined> {
    const record = await prisma.kycRecord.findUnique({
      where: { address: address.toLowerCase() },
    });

    return record ? fromPrismaRecord(record) : undefined;
  }

  async listAll(): Promise<KycRecord[]> {
    const records = await prisma.kycRecord.findMany();
    return records.map(fromPrismaRecord);
  }
}

const driver = process.env.PERSISTENCE_DRIVER ?? (process.env.DATABASE_URL ? 'prisma' : 'file');

export const kycRepository: KycRepository =
  driver === 'prisma'
    ? new PrismaKycRepository()
    : new FileBackedKycRepository();
