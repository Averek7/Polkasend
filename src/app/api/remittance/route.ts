import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RemittanceSchema = z.object({
  senderAddress: z.string().min(1),
  recipientId: z.string().min(1),
  assetId: z.enum(["USDC", "USDT", "DAI"]),
  amountMicro: z.string(), // bigint as string
  deliveryMode: z.enum(["UPI_INSTANT", "IMPS_NEFT", "IINR_WALLET", "AADHAAR_PAY"]),
  signedExtrinsic: z.string().optional(), // pre-signed for broadcast
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = RemittanceSchema.parse(body);

    // 1. Validate KYC via pallet query
    // const api = await getPolkaSendApi();
    // const kycRecord = await api.query.kyc.kycRecords(data.senderAddress);
    // if (!kycRecord || kycRecord.isNone) {
    //   return NextResponse.json({ success: false, error: "KYC required" }, { status: 403 });
    // }

    // 2. Get live FX rate
    const fxRate = await fetchFxRate();

    // 3. Calculate INR output
    const amountUsd = Number(BigInt(data.amountMicro)) / 1_000_000;
    const fee = amountUsd * 0.005;
    const netUsd = amountUsd - fee;
    const inrPaise = Math.round(netUsd * fxRate * 100);

    // 4. Broadcast extrinsic to parachain (if signedExtrinsic provided)
    let orderId: string | null = null;
    if (data.signedExtrinsic) {
      // const api = await getPolkaSendApi();
      // const result = await api.rpc.author.submitExtrinsic(data.signedExtrinsic);
      // orderId = result.toHex();
      orderId = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
    }

    // 5. Trigger fiat settlement (for UPI/IMPS modes) via off-chain service
    if (data.deliveryMode !== "IINR_WALLET" && orderId) {
      // await triggerFiatSettlement({ orderId, recipientId: data.recipientId, inrPaise });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        fxRate,
        inrPaise,
        estimatedSettlementSeconds: getEstimatedTime(data.deliveryMode),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Remittance error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const orderId = searchParams.get("orderId");

  if (!address && !orderId) {
    return NextResponse.json({ success: false, error: "address or orderId required" }, { status: 400 });
  }

  // In production: query pallet_remittance storage
  return NextResponse.json({
    success: true,
    data: [],
  });
}

async function fetchFxRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 60 },
    });
    const json = await res.json();
    return json?.rates?.INR ?? 83.5;
  } catch {
    return 83.5; // fallback
  }
}

function getEstimatedTime(mode: string): number {
  const times: Record<string, number> = {
    UPI_INSTANT: 30,
    IMPS_NEFT: 120,
    IINR_WALLET: 6,
    AADHAAR_PAY: 45,
  };
  return times[mode] ?? 60;
}
