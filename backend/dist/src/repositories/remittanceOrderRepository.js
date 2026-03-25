"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remittanceOrderRepository = void 0;
const prisma_1 = require("../lib/prisma");
const fileStore_1 = require("./fileStore");
const STORAGE_FILE = 'remittance-orders.json';
function serialize(order) {
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
function deserialize(order) {
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
function toPrismaJson(data) {
    if (data === undefined) {
        return undefined;
    }
    return data;
}
function fromPrismaOrder(order) {
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
        deliveryMode: order.deliveryMode,
        status: order.status,
        txHash: order.txHash ?? undefined,
        utrNumber: order.utrNumber ?? undefined,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        updatedAt: order.updatedAt,
        events: (order.events ?? []).map((event) => ({
            type: event.type,
            message: event.message,
            timestamp: event.timestamp,
            data: event.data ?? undefined,
        })),
    };
}
class FileBackedRemittanceOrderRepository {
    orders = new Map();
    constructor() {
        for (const row of (0, fileStore_1.readCollection)(STORAGE_FILE)) {
            const order = deserialize(row);
            this.orders.set(order.id, order);
        }
    }
    async save(order) {
        this.orders.set(order.id, order);
        this.flush();
        return order;
    }
    async findById(id) {
        return this.orders.get(id);
    }
    async listBySender(sender) {
        const normalized = sender.toLowerCase();
        return Array.from(this.orders.values())
            .filter((order) => order.sender.toLowerCase() === normalized)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async listAll() {
        return Array.from(this.orders.values());
    }
    flush() {
        (0, fileStore_1.writeCollection)(STORAGE_FILE, Array.from(this.orders.values()).map(serialize));
    }
}
class PrismaRemittanceOrderRepository {
    async save(order) {
        const saved = await prisma_1.prisma.remittanceOrder.upsert({
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
    async findById(id) {
        const order = await prisma_1.prisma.remittanceOrder.findUnique({
            where: { id },
            include: {
                events: {
                    orderBy: { timestamp: 'asc' },
                },
            },
        });
        return order ? fromPrismaOrder(order) : undefined;
    }
    async listBySender(sender) {
        const orders = await prisma_1.prisma.remittanceOrder.findMany({
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
    async listAll() {
        const orders = await prisma_1.prisma.remittanceOrder.findMany({
            include: {
                events: {
                    orderBy: { timestamp: 'asc' },
                },
            },
        });
        return orders.map(fromPrismaOrder);
    }
}
const driver = process.env.PERSISTENCE_DRIVER ?? (process.env.DATABASE_URL ? 'prisma' : 'file');
exports.remittanceOrderRepository = driver === 'prisma'
    ? new PrismaRemittanceOrderRepository()
    : new FileBackedRemittanceOrderRepository();
