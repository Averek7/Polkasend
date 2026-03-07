import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getUsdInrRate } from './fxOracle';

// ─── Types ────────────────────────────────────────────────────────
export type DeliveryMode = 'UPI_INSTANT' | 'IMPS_NEFT' | 'IINR_WALLET' | 'AADHAAR_PAY';
export type OrderStatus =
  | 'INITIATED'
  | 'RATE_LOCKED'
  | 'COMPLIANCE_PASSED'
  | 'XCM_SENT'
  | 'SETTLEMENT_TRIGGERED'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

export interface RemittanceOrder {
  id: string;
  sender: string;
  recipient: string;
  assetSymbol: string;
  amountIn: number;           // USDC/USDT amount
  amountOutInrPaise: number;  // locked INR in paise
  fxRateLocked: number;       // rate at lock time
  protocolFeePaise: number;
  deliveryMode: DeliveryMode;
  status: OrderStatus;
  txHash?: string;
  utrNumber?: string;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  events: OrderEvent[];
}

export interface OrderEvent {
  type: string;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// ─── In-memory store (replace with DB in production) ──────────────
const orders = new Map<string, RemittanceOrder>();

// ─── Constants ────────────────────────────────────────────────────
const PROTOCOL_FEE_BPS = 50; // 0.5%
const RATE_LOCK_MINUTES = 15;

// ─── Service functions ────────────────────────────────────────────
export async function createOrder(params: {
  sender: string;
  recipient: string;
  assetSymbol: string;
  amountIn: number;
  deliveryMode: DeliveryMode;
}): Promise<RemittanceOrder> {
  const { rate } = await getUsdInrRate();

  const grossInrPaise = Math.round(params.amountIn * rate * 100);
  const feePaise = Math.round(grossInrPaise * (PROTOCOL_FEE_BPS / 10000));
  const netInrPaise = grossInrPaise - feePaise;

  const now = new Date();
  const order: RemittanceOrder = {
    id: '0x' + uuidv4().replace(/-/g, ''),
    sender: params.sender,
    recipient: params.recipient,
    assetSymbol: params.assetSymbol,
    amountIn: params.amountIn,
    amountOutInrPaise: netInrPaise,
    fxRateLocked: rate,
    protocolFeePaise: feePaise,
    deliveryMode: params.deliveryMode,
    status: 'RATE_LOCKED',
    createdAt: now,
    expiresAt: new Date(now.getTime() + RATE_LOCK_MINUTES * 60 * 1000),
    updatedAt: now,
    events: [
      {
        type: 'ORDER_CREATED',
        message: `Order created. FX rate locked at ₹${rate}`,
        timestamp: now,
        data: { fxRate: rate, grossInrPaise, netInrPaise, feePaise },
      },
    ],
  };

  orders.set(order.id, order);
  logger.info(`Order created: ${order.id} | ${params.amountIn} ${params.assetSymbol} → ₹${netInrPaise / 100}`);
  return order;
}

export function getOrder(id: string): RemittanceOrder | undefined {
  return orders.get(id);
}

export function listOrdersBySender(sender: string): RemittanceOrder[] {
  return Array.from(orders.values())
    .filter((o) => o.sender.toLowerCase() === sender.toLowerCase())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  eventData?: { type: string; message: string; data?: Record<string, unknown> }
): RemittanceOrder | null {
  const order = orders.get(id);
  if (!order) return null;

  order.status = status;
  order.updatedAt = new Date();

  if (eventData) {
    order.events.push({
      type: eventData.type,
      message: eventData.message,
      timestamp: new Date(),
      data: eventData.data,
    });
  }

  logger.info(`Order ${id} → ${status}`);
  return order;
}

export function confirmSettlement(id: string, utrNumber: string): RemittanceOrder | null {
  const order = updateOrderStatus(id, 'COMPLETED', {
    type: 'SETTLEMENT_CONFIRMED',
    message: `INR delivered via ${order?.deliveryMode}. UTR: ${utrNumber}`,
    data: { utrNumber },
  });
  if (order) order.utrNumber = utrNumber;
  return order;
}

// Auto-expire orders past their lock time
export function pruneExpiredOrders(): void {
  const now = new Date();
  for (const [id, order] of orders.entries()) {
    if (
      order.expiresAt < now &&
      !['COMPLETED', 'FAILED', 'EXPIRED'].includes(order.status)
    ) {
      updateOrderStatus(id, 'EXPIRED', {
        type: 'ORDER_EXPIRED',
        message: 'Rate lock expired. Please initiate a new order.',
      });
    }
  }
}

setInterval(pruneExpiredOrders, 60_000);
