import { describe, expect, it } from "vitest";
import {
  amlScreen,
  checkAndUpdateLimit,
  getKycRecord,
  setKycRecord,
} from "../src/services/kycService";

describe("kycService", () => {
  it("creates and returns kyc record", () => {
    const address = "0xabc000000000000000000000000000000000001";
    setKycRecord(address, "FULL_KYC", "IN");
    const record = getKycRecord(address);

    expect(record).toBeDefined();
    expect(record?.level).toBe("FULL_KYC");
    expect(record?.countryCode).toBe("IN");
  });

  it("rejects spending when kyc is missing", () => {
    const result = checkAndUpdateLimit(
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
