import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getApiRuntimeMode } from '../_lib/runtimeMode';

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
  contractStatus?: string;
  txHash: string | null;
  utrNumber: string | null;
  amount?: number;
  amountIn?: number;
  currency?: string;
  assetSymbol?: string;
  assetId?: number;
  amountInMinor?: string;
  amountInrPaise?: number;
  amountInr?: number;
  fxRateLocked?: number;
  fxRateLockedScaled?: number;
  feePct?: number;
  feeBps?: number;
  protocolFeePaise?: number;
  deliveryMode?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  estimatedSettlementSeconds?: number;
  contract?: {
    chainId: string;
    paraId: number;
    palletCall: string;
    args: {
      recipient: string;
      assetId: number;
      amount: string;
      deliveryMode: string;
    };
    quote: {
      fxRateScaled: number;
      amountOutInrPaise: number;
      feeBps: number;
    };
  };
  timeline?: Array<{
    type: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
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

function buildContractPayload(input: {
  recipientId: string;
  currency: string;
  deliveryMode: string;
  amount: number;
  fxRateLockedScaled: number;
  amountInrPaise: number;
  feeBps: number;
}) {
  const assetIds: Record<string, number> = {
    USDC: 1337,
    USDT: 1984,
    DAI: 1338,
  };

  return {
    chainId: 'polkasend-para-3000',
    paraId: 3000,
    palletCall: 'remittance.initiate_remittance',
    args: {
      recipient: input.recipientId,
      assetId: assetIds[input.currency] ?? 0,
      amount: Math.round(input.amount * 1_000_000).toString(),
      deliveryMode: input.deliveryMode,
    },
    quote: {
      fxRateScaled: input.fxRateLockedScaled,
      amountOutInrPaise: input.amountInrPaise,
      feeBps: input.feeBps,
    },
  };
}

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

function toContractStatus(status: ClientOrderStatus) {
  const map: Record<ClientOrderStatus, string> = {
    Initiated: 'INITIATED',
    RateLocked: 'RATE_LOCKED',
    CompliancePassed: 'COMPLIANCE_PASSED',
    SettlementTriggered: 'SETTLEMENT_TRIGGERED',
    Completed: 'COMPLETED',
    Failed: 'FAILED',
  };

  return map[status];
}

function normalizeBackendOrder(order: BackendOrder) {
  return {
    orderId: order.orderId,
    status: order.status,
    contractStatus: order.contractStatus ?? order.status,
    txHash: order.txHash,
    utrNumber: order.utrNumber,
    amount: order.amount ?? order.amountIn,
    amountIn: order.amountIn ?? order.amount,
    amountInMinor: order.amountInMinor,
    currency: order.currency ?? order.assetSymbol,
    assetSymbol: order.assetSymbol ?? order.currency,
    assetId: order.assetId,
    amountInrPaise: order.amountInrPaise,
    amountInr: order.amountInr,
    fxRateLocked: order.fxRateLocked,
    fxRateLockedScaled: order.fxRateLockedScaled,
    feePct: order.feePct,
    feeBps: order.feeBps,
    protocolFeePaise: order.protocolFeePaise,
    deliveryMode: order.deliveryMode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    expiresAt: order.expiresAt,
    etaSeconds: order.status === 'Completed' ? 0 : (order.estimatedSettlementSeconds ?? 22),
    contract: order.contract,
    timeline: order.timeline ?? [],
  };
}

async function proxyCreate(body: unknown, backendBaseUrl: string, integrationMode: string) {
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

  const normalized = normalizeBackendOrder(data.data);
  return NextResponse.json({
    success: true,
    ...normalized,
    estimatedSettlement: `${normalized.etaSeconds}s`,
    integrationMode,
  });
}

async function proxyGet(orderId: string, backendBaseUrl: string, integrationMode: string) {
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

  const normalized = normalizeBackendOrder(data.data);
  return NextResponse.json({
    ...normalized,
    integrationMode,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { backendBaseUrl, backendEnabled, integrationMode } = getApiRuntimeMode();
    const body = await req.json();
    const { senderAddress, recipientId, amount, currency, deliveryMode } = body;

    if (!senderAddress || !recipientId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    try {
      if (!backendEnabled) {
        throw new Error('Backend proxy disabled');
      }

      return await proxyCreate({
        senderAddress,
        recipientId,
        amount,
        currency,
        deliveryMode,
      }, backendBaseUrl, integrationMode);
    } catch {
      const orderId = '0x' + randomBytes(32).toString('hex');
      const txHash = '0x' + randomBytes(32).toString('hex');
      const now = new Date().toISOString();
      const baseRate = 83.5;
      const feeBps = 50;
      const amountInrPaise = Math.round(amount * baseRate * 100 * (1 - feeBps / 10_000));
      const contract = buildContractPayload({
        recipientId,
        currency,
        deliveryMode,
        amount,
        fxRateLockedScaled: Math.round(baseRate * 1_000_000),
        amountInrPaise,
        feeBps,
      });

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
        contractStatus: 'RATE_LOCKED',
        amount,
        amountIn: amount,
        amountInMinor: contract.args.amount,
        currency,
        assetSymbol: currency,
        assetId: contract.args.assetId,
        amountInrPaise,
        amountInr: amountInrPaise / 100,
        fxRateLocked: baseRate,
        fxRateLockedScaled: contract.quote.fxRateScaled,
        feePct: feeBps / 100,
        feeBps,
        protocolFeePaise: Math.round(amount * baseRate * 100 * (feeBps / 10_000)),
        deliveryMode,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        etaSeconds: deliveryMode === 'iinr' ? 6 : deliveryMode === 'upi' ? 30 : 120,
        estimatedSettlement: deliveryMode === 'iinr' ? '6s' : deliveryMode === 'upi' ? '30s' : '2min',
        contract,
        timeline: [
          {
            type: 'ORDER_CREATED',
            message: 'Mock order created via Next API fallback',
            timestamp: now,
          },
        ],
        source: 'mock-fallback',
        integrationMode,
      });
    }
  } catch (err) {
    console.error('[remittance/initiate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { backendBaseUrl, backendEnabled, integrationMode } = getApiRuntimeMode();
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  try {
    if (!backendEnabled) {
      throw new Error('Backend proxy disabled');
    }

    return await proxyGet(orderId, backendBaseUrl, integrationMode);
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
      contractStatus: toContractStatus(next.status),
      txHash: next.txHash,
      utrNumber: next.utrNumber,
      amount: next.amount,
      amountIn: next.amount,
      currency: next.currency,
      assetSymbol: next.currency,
      amountInMinor: Math.round(next.amount * 1_000_000).toString(),
      amountInrPaise: Math.round(next.amount * 83.5 * 100 * 0.995),
      amountInr: Math.round(next.amount * 83.5 * 100 * 0.995) / 100,
      fxRateLocked: 83.5,
      fxRateLockedScaled: 83_500_000,
      feePct: 0.5,
      feeBps: 50,
      protocolFeePaise: Math.round(next.amount * 83.5 * 100 * 0.005),
      deliveryMode: next.deliveryMode,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
      etaSeconds: next.status === 'Completed' ? 0 : 22,
      contract: buildContractPayload({
        recipientId: next.recipientId,
        currency: next.currency,
        deliveryMode: next.deliveryMode,
        amount: next.amount,
        fxRateLockedScaled: 83_500_000,
        amountInrPaise: Math.round(next.amount * 83.5 * 100 * 0.995),
        feeBps: 50,
      }),
      timeline: [
        {
          type: 'ORDER_CREATED',
          message: 'Mock order created via Next API fallback',
          timestamp: next.createdAt,
        },
        {
          type: 'STATUS_UPDATE',
          message: `Order progressed to ${next.status}`,
          timestamp: next.updatedAt,
        },
      ],
      source: 'mock-fallback',
      integrationMode,
    });
  }
}
