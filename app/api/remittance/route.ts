import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

type OrderStatus =
  | "Initiated"
  | "RateLocked"
  | "CompliancePassed"
  | "SettlementTriggered"
  | "Completed"
  | "Failed";

type OrderRecord = {
  orderId: string;
  senderAddress: string;
  recipientId: string;
  amount: number;
  currency: string;
  deliveryMode: string;
  txHash: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  utrNumber: string | null;
};

const orderStore = new Map<string, OrderRecord>();

function computeProgress(order: OrderRecord): OrderRecord {
  const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
  const elapsedSec = Math.floor(elapsedMs / 1000);

  let status: OrderStatus = "Initiated";
  if (elapsedSec >= 3) status = "RateLocked";
  if (elapsedSec >= 8) status = "CompliancePassed";
  if (elapsedSec >= 14) status = "SettlementTriggered";
  if (elapsedSec >= 22) status = "Completed";

  const utrNumber =
    status === "Completed"
      ? order.utrNumber ?? `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`
      : null;

  return {
    ...order,
    status,
    utrNumber,
    updatedAt: new Date().toISOString(),
  };
}

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

    const now = new Date().toISOString();
    const order: OrderRecord = {
      orderId,
      senderAddress,
      recipientId,
      amount,
      currency,
      deliveryMode,
      txHash,
      status: "RateLocked",
      createdAt: now,
      updatedAt: now,
      utrNumber: null,
    };

    orderStore.set(orderId, order);

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

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const existing = orderStore.get(orderId);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const next = computeProgress(existing);
  orderStore.set(orderId, next);

  return NextResponse.json({
    orderId: next.orderId,
    status: next.status,
    txHash: next.txHash,
    utrNumber: next.utrNumber,
    amount: next.amount,
    currency: next.currency,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    etaSeconds: next.status === "Completed" ? 0 : 22,
  });
}
