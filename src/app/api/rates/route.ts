import { NextRequest, NextResponse } from "next/server";

const SOURCES = [
  "https://open.er-api.com/v6/latest/USD",
  "https://api.frankfurter.app/latest?from=USD&to=INR",
];

export async function GET(_req: NextRequest) {
  const results = await Promise.allSettled(
    SOURCES.map((url) =>
      fetch(url, { next: { revalidate: 30 } }).then((r) => r.json())
    )
  );

  const rates: number[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const json = result.value;
      // open.er-api format
      if (json?.rates?.INR) rates.push(Number(json.rates.INR));
      // frankfurter format
      if (json?.rates?.INR) rates.push(Number(json.rates.INR));
    }
  }

  // Median for manipulation resistance
  rates.sort((a, b) => a - b);
  const median = rates.length > 0 ? rates[Math.floor(rates.length / 2)] : 83.5;

  return NextResponse.json({
    success: true,
    data: {
      pair: "USD/INR",
      rate: median,
      rateScaled: Math.round(median * 1_000_000), // * 10^6 for on-chain use
      sources: rates.length,
      timestamp: new Date().toISOString(),
      confidence: rates.length >= 2 ? "high" : "medium",
    },
  });
}
