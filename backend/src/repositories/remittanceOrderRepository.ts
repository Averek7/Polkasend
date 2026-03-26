import { Prisma, prisma } from '../lib/prisma';
import { readCollection, writeCollection } from './fileStore';
import type { RemittanceOrder } from '../services/remittanceService';

const STORAGE_FILE = 'remittance-orders.json';

type StoredOrder = Omit<RemittanceOrder, 'createdAt' | 'expiresAt' | 'updatedAt' | 'events'> & {
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  events: Array<{
    type: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
};

export interface RemittanceOrderRepository {
  save(order: RemittanceOrder): Promise<RemittanceOrder>;
  findById(id: string): Promise<RemittanceOrder | undefined>;
  listBySender(sender: string): Promise<RemittanceOrder[]>;
  listAll(): Promise<RemittanceOrder[]>;
  clear(): Promise<void>;
}

function serialize(order: RemittanceOrder): StoredOrder {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    events: order.events.map((event) => ({
      ...event,
      timestamp: event.timestamp.toISOString(),
    })),
  };
}

function deserialize(order: StoredOrder): RemittanceOrder {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    expiresAt: new Date(order.expiresAt),
    updatedAt: new Date(order.updatedAt),
    events: order.events.map((event) => ({
      ...event,
      timestamp: new Date(event.timestamp),
    })),
  };
}

function toPrismaJson(data: Record<string, unknown> | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (data === undefined) {
    return undefined;
  }

  return data as Prisma.InputJsonValue;
}

function fromPrismaOrder(order: {
  id: string;
  sender: string;
  recipient: string;
  assetSymbol: string;
  assetId: number;
  amountIn: number;
  amountInMinor: string;
  amountOutInrPaise: bigint;
  fxRateLocked: number;
  fxRateLockedScaled: number;
  protocolFeeBps: number;
  protocolFeePaise: bigint;
  deliveryMode: string;
  status: string;
  txHash: string | null;
  utrNumber: string | null;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  events?: Array<{
    type: string;
    message: string;
    timestamp: Date;
    data: unknown;
  }>;
}): RemittanceOrder {
  return {
    id: order.id,
    sender: order.sender,
    recipient: order.recipient,
    assetSymbol: order.assetSymbol,
    assetId: order.assetId,
    amountIn: order.amountIn,
    amountInMinor: order.amountInMinor,
    amountOutInrPaise: Number(order.amountOutInrPaise),
    fxRateLocked: order.fxRateLocked,
    fxRateLockedScaled: order.fxRateLockedScaled,
    protocolFeeBps: order.protocolFeeBps,
    protocolFeePaise: Number(order.protocolFeePaise),
    deliveryMode: order.deliveryMode as RemittanceOrder['deliveryMode'],
    status: order.status as RemittanceOrder['status'],
    txHash: order.txHash ?? undefined,
    utrNumber: order.utrNumber ?? undefined,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    updatedAt: order.updatedAt,
    events: (order.events ?? []).map((event) => ({
      type: event.type,
      message: event.message,
      timestamp: event.timestamp,
      data: (event.data as Record<string, unknown> | undefined) ?? undefined,
    })),
  };
}

class FileBackedRemittanceOrderRepository implements RemittanceOrderRepository {
  private orders = new Map<string, RemittanceOrder>();

  constructor() {
    for (const row of readCollection<StoredOrder>(STORAGE_FILE)) {
      const order = deserialize(row);
      this.orders.set(order.id, order);
    }
  }

  async save(order: RemittanceOrder): Promise<RemittanceOrder> {
    this.orders.set(order.id, order);
    this.flush();
    return order;
  }

  async findById(id: string): Promise<RemittanceOrder | undefined> {
    return this.orders.get(id);
  }

  async listBySender(sender: string): Promise<RemittanceOrder[]> {
    const normalized = sender.toLowerCase();
    return Array.from(this.orders.values())
      .filter((order) => order.sender.toLowerCase() === normalized)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(): Promise<RemittanceOrder[]> {
    return Array.from(this.orders.values());
  }

  async clear(): Promise<void> {
    this.orders.clear();
    this.flush();
  }

  private flush() {
    writeCollection(
      STORAGE_FILE,
      Array.from(this.orders.values()).map(serialize),
    );
  }
}

class PrismaRemittanceOrderRepository implements RemittanceOrderRepository {
  async save(order: RemittanceOrder): Promise<RemittanceOrder> {
    const saved = await prisma.remittanceOrder.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        sender: order.sender,
        recipient: order.recipient,
        assetSymbol: order.assetSymbol,
        assetId: order.assetId,
        amountIn: order.amountIn,
        amountInMinor: order.amountInMinor,
        amountOutInrPaise: BigInt(order.amountOutInrPaise),
        fxRateLocked: order.fxRateLocked,
        fxRateLockedScaled: order.fxRateLockedScaled,
        protocolFeeBps: order.protocolFeeBps,
        protocolFeePaise: BigInt(order.protocolFeePaise),
        deliveryMode: order.deliveryMode,
        status: order.status,
        txHash: order.txHash ?? null,
        utrNumber: order.utrNumber ?? null,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        updatedAt: order.updatedAt,
        events: {
          create: order.events.map((event) => ({
            type: event.type,
            message: event.message,
            timestamp: event.timestamp,
            data: toPrismaJson(event.data),
          })),
        },
      },
      update: {
        sender: order.sender,
        recipient: order.recipient,
        assetSymbol: order.assetSymbol,
        assetId: order.assetId,
        amountIn: order.amountIn,
        amountInMinor: order.amountInMinor,
        amountOutInrPaise: BigInt(order.amountOutInrPaise),
        fxRateLocked: order.fxRateLocked,
        fxRateLockedScaled: order.fxRateLockedScaled,
        protocolFeeBps: order.protocolFeeBps,
        protocolFeePaise: BigInt(order.protocolFeePaise),
        deliveryMode: order.deliveryMode,
        status: order.status,
        txHash: order.txHash ?? null,
        utrNumber: order.utrNumber ?? null,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        updatedAt: order.updatedAt,
        events: {
          deleteMany: {},
          create: order.events.map((event) => ({
            type: event.type,
            message: event.message,
            timestamp: event.timestamp,
            data: toPrismaJson(event.data),
          })),
        },
      },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    return fromPrismaOrder(saved);
  }

  async findById(id: string): Promise<RemittanceOrder | undefined> {
    const order = await prisma.remittanceOrder.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    return order ? fromPrismaOrder(order) : undefined;
  }

  async listBySender(sender: string): Promise<RemittanceOrder[]> {
    const orders = await prisma.remittanceOrder.findMany({
      where: { sender: { equals: sender, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    return orders.map(fromPrismaOrder);
  }

  async listAll(): Promise<RemittanceOrder[]> {
    const orders = await prisma.remittanceOrder.findMany({
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    return orders.map(fromPrismaOrder);
  }

  async clear(): Promise<void> {
    await prisma.remittanceOrderEvent.deleteMany();
    await prisma.remittanceOrder.deleteMany();
  }
}

const driver = process.env.PERSISTENCE_DRIVER ?? (process.env.DATABASE_URL ? 'prisma' : 'file');

export const remittanceOrderRepository: RemittanceOrderRepository =
  driver === 'prisma'
    ? new PrismaRemittanceOrderRepository()
    : new FileBackedRemittanceOrderRepository();
