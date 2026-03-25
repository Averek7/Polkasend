"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.getOrder = getOrder;
exports.listOrdersBySender = listOrdersBySender;
exports.updateOrderStatus = updateOrderStatus;
exports.confirmSettlement = confirmSettlement;
exports.pruneExpiredOrders = pruneExpiredOrders;
const uuid_1 = require("uuid");
const logger_1 = require("../config/logger");
const fxOracle_1 = require("./fxOracle");
const remittanceOrderRepository_1 = require("../repositories/remittanceOrderRepository");
const PROTOCOL_FEE_BPS = 50;
const RATE_LOCK_MINUTES = 15;
const ASSET_IDS = {
    USDC: 1337,
    USDT: 1984,
    DAI: 1338,
};
async function createOrder(params) {
    const { rate } = await (0, fxOracle_1.getUsdInrRate)();
    const grossInrPaise = Math.round(params.amountIn * rate * 100);
    const feePaise = Math.round(grossInrPaise * (PROTOCOL_FEE_BPS / 10000));
    const netInrPaise = grossInrPaise - feePaise;
    const assetId = ASSET_IDS[params.assetSymbol] ?? 0;
    const now = new Date();
    const order = {
        id: '0x' + (0, uuid_1.v4)().replace(/-/g, ''),
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
    await remittanceOrderRepository_1.remittanceOrderRepository.save(order);
    logger_1.logger.info(`Order created: ${order.id} | ${params.amountIn} ${params.assetSymbol} -> INR ${netInrPaise / 100}`);
    return order;
}
async function getOrder(id) {
    return remittanceOrderRepository_1.remittanceOrderRepository.findById(id);
}
async function listOrdersBySender(sender) {
    return remittanceOrderRepository_1.remittanceOrderRepository.listBySender(sender);
}
async function updateOrderStatus(id, status, eventData) {
    const order = await remittanceOrderRepository_1.remittanceOrderRepository.findById(id);
    if (!order)
        return null;
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
    logger_1.logger.info(`Order ${id} -> ${status}`);
    return remittanceOrderRepository_1.remittanceOrderRepository.save(order);
}
async function confirmSettlement(id, utrNumber) {
    const existing = await remittanceOrderRepository_1.remittanceOrderRepository.findById(id);
    if (!existing)
        return null;
    const order = await updateOrderStatus(id, 'COMPLETED', {
        type: 'SETTLEMENT_CONFIRMED',
        message: `INR delivered via ${existing.deliveryMode}. UTR: ${utrNumber}`,
        data: { utrNumber },
    });
    if (!order)
        return null;
    order.utrNumber = utrNumber;
    return remittanceOrderRepository_1.remittanceOrderRepository.save(order);
}
async function pruneExpiredOrders() {
    const now = new Date();
    const orders = await remittanceOrderRepository_1.remittanceOrderRepository.listAll();
    for (const order of orders) {
        if (order.expiresAt < now &&
            !['COMPLETED', 'FAILED', 'EXPIRED'].includes(order.status)) {
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
