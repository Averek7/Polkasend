"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRepository = void 0;
const prisma_1 = require("../lib/prisma");
const fileStore_1 = require("./fileStore");
const STORAGE_FILE = 'kyc-records.json';
function serialize(record) {
    return {
        ...record,
        approvedAt: record.approvedAt.toISOString(),
        expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    };
}
function deserialize(record) {
    return {
        ...record,
        approvedAt: new Date(record.approvedAt),
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
    };
}
function fromPrismaRecord(record) {
    return {
        address: record.address,
        level: record.level,
        countryCode: record.countryCode,
        annualLimitUsdCents: Number(record.annualLimitUsdCents),
        ytdSentUsdCents: Number(record.ytdSentUsdCents),
        approvedAt: record.approvedAt,
        expiresAt: record.expiresAt,
        aadhaarHashedRef: record.aadhaarHashedRef ?? undefined,
        panHashedRef: record.panHashedRef ?? undefined,
    };
}
class FileBackedKycRepository {
    records = new Map();
    constructor() {
        for (const row of (0, fileStore_1.readCollection)(STORAGE_FILE)) {
            const record = deserialize(row);
            this.records.set(record.address.toLowerCase(), record);
        }
    }
    async save(record) {
        this.records.set(record.address.toLowerCase(), record);
        this.flush();
        return record;
    }
    async findByAddress(address) {
        return this.records.get(address.toLowerCase());
    }
    async listAll() {
        return Array.from(this.records.values());
    }
    flush() {
        (0, fileStore_1.writeCollection)(STORAGE_FILE, Array.from(this.records.values()).map(serialize));
    }
}
class PrismaKycRepository {
    async save(record) {
        const saved = await prisma_1.prisma.kycRecord.upsert({
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
    async findByAddress(address) {
        const record = await prisma_1.prisma.kycRecord.findUnique({
            where: { address: address.toLowerCase() },
        });
        return record ? fromPrismaRecord(record) : undefined;
    }
    async listAll() {
        const records = await prisma_1.prisma.kycRecord.findMany();
        return records.map(fromPrismaRecord);
    }
}
const driver = process.env.PERSISTENCE_DRIVER ?? (process.env.DATABASE_URL ? 'prisma' : 'file');
exports.kycRepository = driver === 'prisma'
    ? new PrismaKycRepository()
    : new FileBackedKycRepository();
