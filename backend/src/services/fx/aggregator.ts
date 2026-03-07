/**
 * FX Rate Aggregator Service
 *
 * Fetches USD/INR exchange rate from 3 independent sources,
 * returns the median value for manipulation resistance.
 * Caches in-memory with 60-second TTL.
 */

import axios from "axios";

interface RateResult {
  rate: number;
  rateScaled: number; // rate * 10^6 for on-chain use
  source: string;
  fetchedAt: Date;
}

interface AggregatedRate {
  pair: string;
  rate: number;
  rateScaled: number;
  sources: number;
  confidence: "high" | "medium" | "low";
  timestamp: Date;
  ttlSeconds: number;
}

// ─── Source definitions ───────────────────────────────────────────────────────

const SOURCES = [
  {
    name: "open.er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    extract: (data: any): number => data?.rates?.INR,
  },
  {
    name: "frankfurter",
    url: "https://api.frankfurter.app/latest?from=USD&to=INR",
    extract: (data: any): number => data?.rates?.INR,
  },
  {
    name: "exchangerate.host",
    url: "https://api.exchangerate.host/latest?base=USD&symbols=INR",
    extract: (data: any): number => data?.rates?.INR,
  },
];

// ─── In-memory cache ──────────────────────────────────────────────────────────

let cachedRate: AggregatedRate | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

// ─── Core aggregation function ────────────────────────────────────────────────

export async function getAggregatedFxRate(): Promise<AggregatedRate> {
  // Return cached rate if still fresh
  if (cachedRate && Date.now() - cachedRate.timestamp.getTime() < CACHE_TTL_MS) {
    return cachedRate;
  }

  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const res = await axios.get(source.url, { timeout: 5000 });
      const rate = source.extract(res.data);
      if (!rate || typeof rate !== "number" || rate < 50 || rate > 200) {
        throw new Error(`Invalid rate from ${source.name}: ${rate}`);
      }
      return { rate, source: source.name } as RateResult;
    })
  );

  const rates: number[] = [];
  const successSources: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      rates.push(result.value.rate);
      successSources.push(result.value.source);
    }
  }

  if (rates.length === 0) {
    // Fallback to last cached rate or hard-coded fallback
    if (cachedRate) {
      console.warn("FX: all sources failed, using stale cache");
      return { ...cachedRate, confidence: "low", timestamp: new Date() };
    }
    return {
      pair: "USD/INR",
      rate: 83.5,
      rateScaled: 83_500_000,
      sources: 0,
      confidence: "low",
      timestamp: new Date(),
      ttlSeconds: 60,
    };
  }

  // Median (manipulation-resistant)
  rates.sort((a, b) => a - b);
  const medianRate = rates[Math.floor(rates.length / 2)];
  const confidence: AggregatedRate["confidence"] =
    rates.length >= 3 ? "high" : rates.length === 2 ? "medium" : "low";

  cachedRate = {
    pair: "USD/INR",
    rate: medianRate,
    rateScaled: Math.round(medianRate * 1_000_000),
    sources: rates.length,
    confidence,
    timestamp: new Date(),
    ttlSeconds: 60,
  };

  return cachedRate;
}

// ─── Background refresh ───────────────────────────────────────────────────────

export async function startFxAggregator(): Promise<void> {
  // Initial fetch
  try {
    await getAggregatedFxRate();
  } catch (e) {
    console.error("FX initial fetch failed:", e);
  }

  // Refresh every 60 seconds
  setInterval(async () => {
    try {
      await getAggregatedFxRate();
    } catch (e) {
      console.error("FX refresh failed:", e);
    }
  }, CACHE_TTL_MS);
}

// ─── Fee calculator ───────────────────────────────────────────────────────────

export function calculateRemittance(
  sendAmountUsd: number,
  fxRate: number
): {
  grossInr: number;
  feeUsd: number;
  feeInr: number;
  netInr: number;
  feePct: number;
  netInrPaise: number;
} {
  const feePct = 0.005; // 0.5%
  const feeUsd = sendAmountUsd * feePct;
  const netUsd = sendAmountUsd - feeUsd;
  const grossInr = sendAmountUsd * fxRate;
  const feeInr = feeUsd * fxRate;
  const netInr = netUsd * fxRate;
  const netInrPaise = Math.round(netInr * 100);

  return { grossInr, feeUsd, feeInr, netInr, feePct: feePct * 100, netInrPaise };
}
