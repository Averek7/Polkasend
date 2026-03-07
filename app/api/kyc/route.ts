import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, level, aadhaarNumber, panNumber, countryCode } = body;

    if (!address || !level) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Hash PII — never store raw
    const aadhaarHash = aadhaarNumber
      ? createHash('sha256').update(aadhaarNumber).digest('hex')
      : null;
    const panHash = panNumber
      ? createHash('sha256').update(panNumber.toUpperCase()).digest('hex')
      : null;

    // In production: call pallet_kyc::submit_kyc extrinsic
    // Store hashes on-chain; raw data goes to encrypted off-chain storage (IPFS + AES)

    const annualLimits: Record<string, number> = {
      BasicKyc:          250_000,        // $2,500 in cents
      FullKyc:           25_000_000,     // $250,000 in cents
      InstitutionalKyc:  1_000_000_000,  // $10M in cents
    };

    return NextResponse.json({
      success: true,
      address,
      level,
      aadhaarHash,
      panHash,
      annualLimitUsdCents: annualLimits[level] ?? 250_000,
      status: 'PendingApproval', // Authority will approve via pallet
      message: 'KYC submitted. Approval typically takes 5–30 minutes.',
    });
  } catch (err) {
    console.error('[kyc/submit]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  // In production: query pallet_kyc::KycRecords on-chain
  return NextResponse.json({
    address,
    level: 'FullKyc',
    annualLimitUsdCents: 25_000_000,
    ytdSentUsdCents: 0,
    approvedAt: new Date().toISOString(),
  });
}
