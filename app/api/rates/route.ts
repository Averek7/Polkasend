import { NextResponse } from 'next/server';

// Cache rate for 30 seconds
let cachedRate: { rate: number; ts: number } | null = null;

export async function GET() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedRate && now - cachedRate.ts < 30_000) {
    return NextResponse.json({
      rate: cachedRate.rate,
      source: 'cache',
      updatedAt: new Date(cachedRate.ts).toISOString(),
    });
  }

  // In production: aggregate from multiple oracle sources
  // Simulated here with a realistic range
  const base  = 83.50;
  const delta = (Math.random() - 0.5) * 0.3; // ±0.15 fluctuation
  const rate  = parseFloat((base + delta).toFixed(4));

  cachedRate = { rate, ts: now };

  return NextResponse.json({
    rate,
    pair: 'USD/INR',
    source: 'polkasend-oracle-aggregate',
    updatedAt: new Date(now).toISOString(),
    breakdown: {
      source1: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
      source2: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
      source3: parseFloat((base + (Math.random() - 0.5) * 0.2).toFixed(4)),
      median: rate,
    },
  });
}
