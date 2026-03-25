import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

type ClientOrderStatus =
  | 'Initiated'
  | 'RateLocked'
  | 'CompliancePassed'
  | 'SettlementTriggered'
  | 'Completed'
  | 'Failed';

type BackendOrder = {
  orderId: string;
  status: ClientOrderStatus;
  txHash: string | null;
  utrNumber: string | null;
  amount?: number;
  amountIn?: number;
  currency?: string;
  assetSymbol?: string;
  createdAt?: string;
  updatedAt?: string;
  estimatedSettlementSeconds?: number;
};

type BackendResponse = {
  success: boolean;
  data?: BackendOrder;
  error?: string;
};

type MockOrderRecord = {
  orderId: string;
  senderAddress: string;
  recipientId: string;
  amount: number;
  currency: string;
  deliveryMode: string;
  txHash: string;
  status: ClientOrderStatus;
  createdAt: string;
  updatedAt: string;
  utrNumber: string | null;
};

const orderStore = new Map<string, MockOrderRecord>();
const backendBaseUrl = process.env.POLKASEND_BACKEND_URL ?? 'http://localhost:4000';

function computeProgress(order: MockOrderRecord): MockOrderRecord {
  const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
  const elapsedSec = Math.floor(elapsedMs / 1000);

  let status: ClientOrderStatus = 'Initiated';
  if (elapsedSec >= 3) status = 'RateLocked';
  if (elapsedSec >= 8) status = 'CompliancePassed';
  if (elapsedSec >= 14) status = 'SettlementTriggered';
  if (elapsedSec >= 22) status = 'Completed';

  const utrNumber =
    status === 'Completed'
      ? order.utrNumber ?? `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`
      : null;

  return {
    ...order,
    status,
    utrNumber,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeBackendOrder(order: BackendOrder) {
  return {
    orderId: order.orderId,
    status: order.status,
    txHash: order.txHash,
    utrNumber: order.utrNumber,
    amount: order.amount ?? order.amountIn,
    currency: order.currency ?? order.assetSymbol,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    etaSeconds: order.status === 'Completed' ? 0 : (order.estimatedSettlementSeconds ?? 22),
  };
}

async function proxyCreate(body: unknown) {
  const response = await fetch(`${backendBaseUrl}/api/remittance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = (await response.json()) as BackendResponse;
  if (!response.ok || !data.success || !data.data) {
    return NextResponse.json(
      { error: data.error ?? 'Backend remittance create failed' },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json({
    success: true,
    orderId: data.data.orderId,
    txHash: data.data.txHash,
    status: data.data.status,
    estimatedSettlement: `${data.data.estimatedSettlementSeconds ?? 22}s`,
  });
}

async function proxyGet(orderId: string) {
  const response = await fetch(
    `${backendBaseUrl}/api/remittance?orderId=${encodeURIComponent(orderId)}`,
    { cache: 'no-store' },
  );

  const data = (await response.json()) as BackendResponse;
  if (!response.ok || !data.success || !data.data) {
    return NextResponse.json(
      { error: data.error ?? 'Backend remittance lookup failed' },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(normalizeBackendOrder(data.data));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderAddress, recipientId, amount, currency, deliveryMode } = body;

    if (!senderAddress || !recipientId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    try {
      return await proxyCreate({
        senderAddress,
        recipientId,
        amount,
        currency,
        deliveryMode,
      });
    } catch {
      const orderId = '0x' + randomBytes(32).toString('hex');
      const txHash = '0x' + randomBytes(32).toString('hex');
      const now = new Date().toISOString();

      const order: MockOrderRecord = {
        orderId,
        senderAddress,
        recipientId,
        amount,
        currency,
        deliveryMode,
        txHash,
        status: 'RateLocked',
        createdAt: now,
        updatedAt: now,
        utrNumber: null,
      };

      orderStore.set(orderId, order);

      return NextResponse.json({
        success: true,
        orderId,
        txHash,
        status: 'RateLocked',
        estimatedSettlement: deliveryMode === 'iinr' ? '6s' : deliveryMode === 'upi' ? '30s' : '2min',
        source: 'mock-fallback',
      });
    }
  } catch (err) {
    console.error('[remittance/initiate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  try {
    return await proxyGet(orderId);
  } catch {
    const existing = orderStore.get(orderId);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
      etaSeconds: next.status === 'Completed' ? 0 : 22,
      source: 'mock-fallback',
    });
  }
}
