"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const kycService_1 = require("../src/services/kycService");
(0, vitest_1.describe)("kycService", () => {
    (0, vitest_1.it)("creates and returns kyc record", () => {
        const address = "0xabc000000000000000000000000000000000001";
        (0, kycService_1.setKycRecord)(address, "FULL_KYC", "IN");
        const record = (0, kycService_1.getKycRecord)(address);
        (0, vitest_1.expect)(record).toBeDefined();
        (0, vitest_1.expect)(record?.level).toBe("FULL_KYC");
        (0, vitest_1.expect)(record?.countryCode).toBe("IN");
    });
    (0, vitest_1.it)("rejects spending when kyc is missing", () => {
        const result = (0, kycService_1.checkAndUpdateLimit)("0xmissing00000000000000000000000000000000", 100_00);
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe("KYC_REQUIRED");
    });
    (0, vitest_1.it)("passes aml check for normal addresses", () => {
        const result = (0, kycService_1.amlScreen)("0xgood00000000000000000000000000000000000");
        (0, vitest_1.expect)(result.pass).toBe(true);
    });
});
