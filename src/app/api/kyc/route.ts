import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const KycSubmitSchema = z.object({
  accountId: z.string().min(1),
  level: z.enum(["BASIC_KYC", "FULL_KYC"]),
  countryCode: z.string().length(2),
  // Hashes only — raw PII never stored here
  aadhaarHash: z.string().length(64).optional(), // SHA3-256 hex
  panHash: z.string().length(64).optional(),
  // IPFS CID of encrypted KYC documents
  documentsCid: z.string().optional(),
});

const KycApproveSchema = z.object({
  accountId: z.string().min(1),
  approved: z.boolean(),
  annualLimitUsdCents: z.number().int().positive(),
  // Authority signature (KYC provider)
  authoritySignature: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...rest } = body;

    if (action === "submit") {
      const data = KycSubmitSchema.parse(rest);

      // In production:
      // 1. Store document CID in IPFS-backed KYC registry
      // 2. Submit pallet_kyc::submit_kyc extrinsic
      // 3. Notify KYC provider for verification

      return NextResponse.json({
        success: true,
        data: {
          status: "PENDING_REVIEW",
          submittedAt: new Date().toISOString(),
          estimatedReviewHours: 2,
          message: "KYC submission received. You'll be notified once verified.",
        },
      });
    }

    if (action === "approve") {
      const data = KycApproveSchema.parse(rest);
      // Validate authority signature
      // Broadcast pallet_kyc::approve_kyc extrinsic
      return NextResponse.json({ success: true, data: { approved: data.approved } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ success: false, error: "accountId required" }, { status: 400 });
  }

  // In production: query pallet_kyc::kycRecords(accountId)
  // Simulated response
  return NextResponse.json({
    success: true,
    data: null, // null means no KYC on file
  });
}
