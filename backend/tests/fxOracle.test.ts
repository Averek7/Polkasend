import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { getRateMultiplied, getUsdInrRate } from "../src/services/fxOracle";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("fxOracle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns scaled rate value", () => {
    expect(getRateMultiplied(83.5)).toBe(83_500_000);
  });

  it("aggregates and returns valid usd/inr rate", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { rates: { INR: 83.4 } } } as never)
      .mockResolvedValueOnce({ data: { rates: { INR: 83.5 } } } as never)
      .mockResolvedValueOnce({ data: { rates: { INR: 83.6 } } } as never);

    const result = await getUsdInrRate();
    expect(result.rate).toBeGreaterThan(80);
    expect(result.rate).toBeLessThan(90);
    expect(result.sources.length).toBeGreaterThan(0);
  });
});
