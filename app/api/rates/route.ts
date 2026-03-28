import { NextResponse } from 'next/server';
import { getApiRuntimeMode } from '../_lib/runtimeMode';

type BackendRatesResponse = {
  success: boolean;
  data?: {
    rate: number;
    pair: string;
    source: string;
    sources: string[];
    rateScaled: number;
    updatedAt: string;
    cached: boolean;
  };
  error?: string;
};

let cachedRate: { rate: number; ts: number } | null = null;

export async function GET() {
  const { backendBaseUrl, backendEnabled, integrationMode } = getApiRuntimeMode();

  try {
    if (!backendEnabled) {
      throw new Error('Backend proxy disabled');
    }

    const response = await fetch(`${backendBaseUrl}/api/rates`, { cache: 'no-store' });
    const data = (await response.json()) as BackendRatesResponse;

    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error ?? 'Backend rates fetch failed');
    }

    return NextResponse.json({
      rate: data.data.rate,
      pair: data.data.pair,
      source: data.data.source,
      updatedAt: data.data.updatedAt,
      sources: data.data.sources,
      rateScaled: data.data.rateScaled,
      cached: data.data.cached,
      integrationMode,
    });
  } catch {
    const now = Date.now();

    if (cachedRate && now - cachedRate.ts < 30_000) {
      return NextResponse.json({
        rate: cachedRate.rate,
        source: 'cache',
        updatedAt: new Date(cachedRate.ts).toISOString(),
        integrationMode,
      });
    }

    const base = 83.5;
    const delta = (Math.random() - 0.5) * 0.3;
    const rate = parseFloat((base + delta).toFixed(4));

    cachedRate = { rate, ts: now };

    return NextResponse.json({
      rate,
      pair: 'USD/INR',
      source: 'mock-fallback',
      updatedAt: new Date(now).toISOString(),
      integrationMode,
      breakdown: {
        source1: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
        source2: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
        source3: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
        median: rate,
      },
    });
  }
}
