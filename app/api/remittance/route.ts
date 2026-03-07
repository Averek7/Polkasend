import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderAddress, recipientId, amount, currency, deliveryMode } = body;

    if (!senderAddress || !recipientId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // In production: this would call the Substrate node extrinsic
    // For now: simulate the on-chain submission
    const orderId = '0x' + randomBytes(32).toString('hex');
    const txHash  = '0x' + randomBytes(32).toString('hex');

    // Simulate KYC check
    const kycPassed = true; // In prod: query pallet_kyc::KycRecords

    if (!kycPassed) {
      return NextResponse.json({ error: 'KYC required' }, { status: 403 });
    }

    // Simulate FX rate fetch
    const fxRate = 83.50 + (Math.random() - 0.5) * 0.2;

    // Calculate INR amount
    const fee       = amount * 0.005;
    const netAmount = amount - fee;
    const inrPaise  = Math.round(netAmount * fxRate * 100);

    return NextResponse.json({
      success: true,
      orderId,
      txHash,
      fxRateLocked: fxRate,
      amountInrPaise: inrPaise,
      amountInr: inrPaise / 100,
      feePct: 0.5,
      estimatedSettlement: deliveryMode === 'iinr' ? '6s' : deliveryMode === 'upi' ? '30s' : '2min',
      status: 'RateLocked',
    });
  } catch (err) {
    console.error('[remittance/initiate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
