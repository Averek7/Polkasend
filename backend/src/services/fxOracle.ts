import axios from 'axios';
import { logger } from '../config/logger';

interface RateCache {
  rate: number;
  timestamp: number;
  sources: string[];
}

let cache: RateCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 second cache

const RATE_SOURCES = [
  {
    name: 'exchangerate.host',
    url: 'https://api.exchangerate.host/latest?base=USD&symbols=INR',
    parse: (d: any) => d?.rates?.INR as number,
  },
  {
    name: 'open.er-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (d: any) => d?.rates?.INR as number,
  },
  {
    name: 'frankfurter.app',
    url: 'https://api.frankfurter.app/latest?from=USD&to=INR',
    parse: (d: any) => d?.rates?.INR as number,
  },
];

async function fetchFromSource(source: typeof RATE_SOURCES[number]): Promise<number | null> {
  try {
    const res = await axios.get(source.url, { timeout: 3000 });
    const rate = source.parse(res.data);
    if (typeof rate === 'number' && rate > 0) return rate;
    return null;
  } catch (err) {
    logger.warn(`FX source ${source.name} failed: ${(err as Error).message}`);
    return null;
  }
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function getUsdInrRate(): Promise<{ rate: number; sources: string[]; cached: boolean }> {
  // Return cache if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return { rate: cache.rate, sources: cache.sources, cached: true };
  }

  const results = await Promise.allSettled(RATE_SOURCES.map(fetchFromSource));
  const rates: number[] = [];
  const successSources: string[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value !== null) {
      rates.push(result.value);
      successSources.push(RATE_SOURCES[i].name);
    }
  });

  if (rates.length === 0) {
    // Fallback to cached value or hardcoded fallback
    if (cache) {
      logger.warn('All FX sources failed, using stale cache');
      return { rate: cache.rate, sources: ['stale-cache'], cached: true };
    }
    logger.warn('All FX sources failed, using hardcoded fallback rate');
    return { rate: 83.50, sources: ['fallback'], cached: false };
  }

  // Circuit breaker: reject if any rate deviates > 5% from median
  const med = median(rates);
  const validRates = rates.filter(
    (r, i) => Math.abs(r - med) / med <= 0.05
  );
  const finalRate = parseFloat(median(validRates.length > 0 ? validRates : rates).toFixed(4));

  cache = { rate: finalRate, timestamp: Date.now(), sources: successSources };
  logger.info(`FX rate updated: ₹${finalRate} (sources: ${successSources.join(', ')})`);

  return { rate: finalRate, sources: successSources, cached: false };
}

export function getRateMultiplied(rate: number): number {
  // On-chain representation: rate * 10^6
  return Math.round(rate * 1_000_000);
}
