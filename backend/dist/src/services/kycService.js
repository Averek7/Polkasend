"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKycRecord = getKycRecord;
exports.setKycRecord = setKycRecord;
exports.checkAndUpdateLimit = checkAndUpdateLimit;
exports.amlScreen = amlScreen;
const logger_1 = require("../config/logger");
const kycRepository_1 = require("../repositories/kycRepository");
const LIMITS = {
    NONE: 0,
    BASIC_KYC: 250_000,
    FULL_KYC: 25_000_000,
    INSTITUTIONAL: 999_999_999,
};
async function getKycRecord(address) {
    return kycRepository_1.kycRepository.findByAddress(address);
}
async function setKycRecord(address, level, countryCode) {
    const record = {
        address: address.toLowerCase(),
        level,
        countryCode,
        annualLimitUsdCents: LIMITS[level],
        ytdSentUsdCents: 0,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
    await kycRepository_1.kycRepository.save(record);
    logger_1.logger.info(`KYC approved: ${address} -> ${level}`);
    return record;
}
async function checkAndUpdateLimit(address, amountUsdCents) {
    const record = await kycRepository_1.kycRepository.findByAddress(address);
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
    await kycRepository_1.kycRepository.save(record);
    return { ok: true };
}
const SANCTIONED_ADDRESSES = new Set([]);
function amlScreen(address) {
    if (SANCTIONED_ADDRESSES.has(address.toLowerCase())) {
        logger_1.logger.warn(`AML hit: ${address}`);
        return { pass: false, reason: 'SANCTIONS_LIST_MATCH' };
    }
    return { pass: true };
}
