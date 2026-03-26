import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getUsdInrRate } from './fxOracle';
import { remittanceOrderRepository } from '../repositories/remittanceOrderRepository';

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
  assetId: number;
  amountIn: number;
  amountInMinor: string;
  amountOutInrPaise: number;
  fxRateLocked: number;
  fxRateLockedScaled: number;
  protocolFeeBps: number;
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

const PROTOCOL_FEE_BPS = 50;
const RATE_LOCK_MINUTES = 15;
const ASSET_IDS: Record<string, number> = {
  USDC: 1337,
  USDT: 1984,
  DAI: 1338,
};

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
  const assetId = ASSET_IDS[params.assetSymbol] ?? 0;

  const now = new Date();
  const order: RemittanceOrder = {
    id: '0x' + uuidv4().replace(/-/g, ''),
    sender: params.sender,
    recipient: params.recipient,
    assetSymbol: params.assetSymbol,
    assetId,
    amountIn: params.amountIn,
    amountInMinor: Math.round(params.amountIn * 1_000_000).toString(),
    amountOutInrPaise: netInrPaise,
    fxRateLocked: rate,
    fxRateLockedScaled: Math.round(rate * 1_000_000),
    protocolFeeBps: PROTOCOL_FEE_BPS,
    protocolFeePaise: feePaise,
    deliveryMode: params.deliveryMode,
    status: 'RATE_LOCKED',
    createdAt: now,
    expiresAt: new Date(now.getTime() + RATE_LOCK_MINUTES * 60 * 1000),
    updatedAt: now,
    events: [
      {
        type: 'ORDER_CREATED',
        message: `Order created. FX rate locked at INR ${rate}`,
        timestamp: now,
        data: { fxRate: rate, grossInrPaise, netInrPaise, feePaise },
      },
    ],
  };

  await remittanceOrderRepository.save(order);
  logger.info(`Order created: ${order.id} | ${params.amountIn} ${params.assetSymbol} -> INR ${netInrPaise / 100}`);
  return order;
}

export async function getOrder(id: string): Promise<RemittanceOrder | undefined> {
  return remittanceOrderRepository.findById(id);
}

export async function listOrdersBySender(sender: string): Promise<RemittanceOrder[]> {
  return remittanceOrderRepository.listBySender(sender);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  eventData?: { type: string; message: string; data?: Record<string, unknown> },
): Promise<RemittanceOrder | null> {
  const order = await remittanceOrderRepository.findById(id);
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

  logger.info(`Order ${id} -> ${status}`);
  return remittanceOrderRepository.save(order);
}

export async function confirmSettlement(id: string, utrNumber: string): Promise<RemittanceOrder | null> {
  const existing = await remittanceOrderRepository.findById(id);
  if (!existing) return null;

  const order = await updateOrderStatus(id, 'COMPLETED', {
    type: 'SETTLEMENT_CONFIRMED',
    message: `INR delivered via ${existing.deliveryMode}. UTR: ${utrNumber}`,
    data: { utrNumber },
  });
  if (!order) return null;

  order.utrNumber = utrNumber;
  return remittanceOrderRepository.save(order);
}

export async function pruneExpiredOrders(): Promise<void> {
  const now = new Date();
  const orders = await remittanceOrderRepository.listAll();

  for (const order of orders) {
    if (
      order.expiresAt < now &&
      !['COMPLETED', 'FAILED', 'EXPIRED'].includes(order.status)
    ) {
      await updateOrderStatus(order.id, 'EXPIRED', {
        type: 'ORDER_EXPIRED',
        message: 'Rate lock expired. Please initiate a new order.',
      });
    }
  }
}

setInterval(() => {
  void pruneExpiredOrders();
}, 60_000);

export async function __resetOrdersForTests(): Promise<void> {
  await remittanceOrderRepository.clear();
}
