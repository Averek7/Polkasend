import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetKycForTests,
  amlScreen,
  checkAndUpdateLimit,
  getKycRecord,
  setKycRecord,
} from "../src/services/kycService";

describe("kycService", () => {
  beforeEach(async () => {
    await __resetKycForTests();
  });

  it("creates and returns kyc record", async () => {
    const address = "0xabc000000000000000000000000000000000001";
    await setKycRecord(address, "FULL_KYC", "IN");
    const record = await getKycRecord(address);

    expect(record).toBeDefined();
    expect(record?.level).toBe("FULL_KYC");
    expect(record?.countryCode).toBe("IN");
  });

  it("rejects spending when kyc is missing", async () => {
    const result = await checkAndUpdateLimit(
      "0xmissing00000000000000000000000000000000",
      100_00,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("KYC_REQUIRED");
  });

  it("passes aml check for normal addresses", () => {
    const result = amlScreen("0xgood00000000000000000000000000000000000");
    expect(result.pass).toBe(true);
  });
});
