import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getApiRuntimeMode } from '../_lib/runtimeMode';

type BackendKycRecord = {
  level?: 'NONE' | 'BASIC_KYC' | 'FULL_KYC' | 'INSTITUTIONAL';
  address?: string;
  annualLimitUsdCents?: number;
  ytdSentUsdCents?: number;
  approvedAt?: string;
  expiresAt?: string | null;
  countryCode?: string;
};

type BackendKycResponse = {
  success: boolean;
  data?: BackendKycRecord;
  error?: string;
};

function normalizeKycLevel(level?: string) {
  const levelMap: Record<string, string> = {
    NONE: 'None',
    BASIC_KYC: 'BasicKyc',
    FULL_KYC: 'FullKyc',
    INSTITUTIONAL: 'InstitutionalKyc',
    BasicKyc: 'BasicKyc',
    FullKyc: 'FullKyc',
    InstitutionalKyc: 'InstitutionalKyc',
  };

  return levelMap[level ?? ''] ?? 'None';
}

function annualLimitForLevel(level: string) {
  const annualLimits: Record<string, number> = {
    BasicKyc: 250_000,
    FullKyc: 25_000_000,
    InstitutionalKyc: 1_000_000_000,
    None: 0,
  };

  return annualLimits[level] ?? 0;
}

export async function POST(req: NextRequest) {
  try {
    const { integrationMode } = getApiRuntimeMode();
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

    return NextResponse.json({
      success: true,
      address,
      level,
      aadhaarHash,
      panHash,
      annualLimitUsdCents: annualLimitForLevel(level),
      status: 'PendingApproval', // Authority will approve via pallet
      message: 'KYC submitted. Approval typically takes 5–30 minutes.',
      integrationMode,
    });
  } catch (err) {
    console.error('[kyc/submit]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { backendBaseUrl, backendEnabled, integrationMode } = getApiRuntimeMode();
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    if (!backendEnabled) {
      throw new Error('Backend proxy disabled');
    }

    const response = await fetch(
      `${backendBaseUrl}/api/kyc/${encodeURIComponent(address)}`,
      { cache: 'no-store' },
    );
    const data = (await response.json()) as BackendKycResponse;

    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error ?? 'Backend kyc fetch failed');
    }

    const normalizedLevel = normalizeKycLevel(data.data.level);

    return NextResponse.json({
      address: data.data.address ?? address,
      level: normalizedLevel,
      annualLimitUsdCents: data.data.annualLimitUsdCents ?? annualLimitForLevel(normalizedLevel),
      ytdSentUsdCents: data.data.ytdSentUsdCents ?? 0,
      approvedAt: data.data.approvedAt ?? null,
      expiresAt: data.data.expiresAt ?? null,
      countryCode: data.data.countryCode ?? null,
      source: 'backend',
      integrationMode,
    });
  } catch {
    return NextResponse.json({
      address,
      level: 'FullKyc',
      annualLimitUsdCents: 25_000_000,
      ytdSentUsdCents: 0,
      approvedAt: new Date().toISOString(),
      source: 'mock-fallback',
      integrationMode,
    });
  }
}
