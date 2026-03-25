"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const remittanceService_1 = require("../services/remittanceService");
const kycService_1 = require("../services/kycService");
const router = (0, express_1.Router)();
const PARA_ID = 3000;
const CHAIN_ID = 'polkasend-para-3000';
const PALLET_CALL = 'remittance.initiate_remittance';
const deliveryModeSchema = zod_1.z.enum([
    'UPI_INSTANT',
    'IMPS_NEFT',
    'IINR_WALLET',
    'AADHAAR_PAY',
    'upi',
    'imps',
    'iinr',
    'aadhaar',
]);
const createSchema = zod_1.z.object({
    sender: zod_1.z.string().min(10).optional(),
    senderAddress: zod_1.z.string().min(10).optional(),
    recipient: zod_1.z.string().min(3).optional(),
    recipientId: zod_1.z.string().min(3).optional(),
    assetSymbol: zod_1.z.enum(['USDC', 'USDT', 'DAI']).optional(),
    currency: zod_1.z.enum(['USDC', 'USDT', 'DAI']).optional(),
    amountIn: zod_1.z.coerce.number().positive().max(250_000).optional(),
    amount: zod_1.z.coerce.number().positive().max(250_000).optional(),
    deliveryMode: deliveryModeSchema,
});
const confirmSchema = zod_1.z.object({
    utrNumber: zod_1.z.string().min(12).max(22),
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum([
        'INITIATED',
        'RATE_LOCKED',
        'COMPLIANCE_PASSED',
        'XCM_SENT',
        'SETTLEMENT_TRIGGERED',
        'COMPLETED',
        'FAILED',
        'EXPIRED',
    ]),
    eventType: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
function normalizeDeliveryMode(mode) {
    const map = {
        UPI_INSTANT: 'UPI_INSTANT',
        IMPS_NEFT: 'IMPS_NEFT',
        IINR_WALLET: 'IINR_WALLET',
        AADHAAR_PAY: 'AADHAAR_PAY',
        upi: 'UPI_INSTANT',
        imps: 'IMPS_NEFT',
        iinr: 'IINR_WALLET',
        aadhaar: 'AADHAAR_PAY',
    };
    return map[mode];
}
function toClientStatus(status) {
    const map = {
        INITIATED: 'Initiated',
        RATE_LOCKED: 'RateLocked',
        COMPLIANCE_PASSED: 'CompliancePassed',
        XCM_SENT: 'SettlementTriggered',
        SETTLEMENT_TRIGGERED: 'SettlementTriggered',
        COMPLETED: 'Completed',
        FAILED: 'Failed',
        EXPIRED: 'Failed',
    };
    return map[status];
}
function estimatedSettlementSeconds(mode) {
    switch (mode) {
        case 'IINR_WALLET':
            return 6;
        case 'UPI_INSTANT':
            return 30;
        case 'AADHAAR_PAY':
            return 45;
        case 'IMPS_NEFT':
        default:
            return 120;
    }
}
function serializeOrder(order) {
    return {
        orderId: order.id,
        status: toClientStatus(order.status),
        contractStatus: order.status,
        senderAddress: order.sender,
        recipientId: order.recipient,
        currency: order.assetSymbol,
        assetSymbol: order.assetSymbol,
        assetId: order.assetId,
        amount: order.amountIn,
        amountIn: order.amountIn,
        amountInMinor: order.amountInMinor,
        amountInrPaise: order.amountOutInrPaise,
        amountInr: order.amountOutInrPaise / 100,
        fxRateLocked: order.fxRateLocked,
        fxRateLockedScaled: order.fxRateLockedScaled,
        feePct: order.protocolFeeBps / 100,
        feeBps: order.protocolFeeBps,
        protocolFeePaise: order.protocolFeePaise,
        deliveryMode: order.deliveryMode,
        txHash: order.txHash ?? order.id,
        utrNumber: order.utrNumber ?? null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        expiresAt: order.expiresAt.toISOString(),
        estimatedSettlementSeconds: estimatedSettlementSeconds(order.deliveryMode),
        contract: {
            chainId: CHAIN_ID,
            paraId: PARA_ID,
            palletCall: PALLET_CALL,
            args: {
                recipient: order.recipient,
                assetId: order.assetId,
                amount: order.amountInMinor,
                deliveryMode: order.deliveryMode,
            },
            quote: {
                fxRateScaled: order.fxRateLockedScaled,
                amountOutInrPaise: order.amountOutInrPaise,
                feeBps: order.protocolFeeBps,
            },
        },
        timeline: order.events.map((event) => ({
            type: event.type,
            message: event.message,
            timestamp: event.timestamp.toISOString(),
            data: event.data,
        })),
    };
}
function readOrderId(req) {
    const fromQuery = req.query.orderId;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) {
        return fromQuery;
    }
    if (typeof req.params.id === 'string' && req.params.id.length > 0) {
        return req.params.id;
    }
    return null;
}
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const sender = parsed.data.senderAddress ?? parsed.data.sender;
    const recipient = parsed.data.recipientId ?? parsed.data.recipient;
    const assetSymbol = parsed.data.currency ?? parsed.data.assetSymbol;
    const amountIn = parsed.data.amount ?? parsed.data.amountIn;
    if (!sender || !recipient || !assetSymbol || amountIn === undefined) {
        return res.status(400).json({
            success: false,
            error: 'senderAddress, recipientId, currency, amount, and deliveryMode are required',
        });
    }
    const deliveryMode = normalizeDeliveryMode(parsed.data.deliveryMode);
    const aml = (0, kycService_1.amlScreen)(sender);
    if (!aml.pass) {
        return res.status(403).json({ success: false, error: `AML check failed: ${aml.reason}` });
    }
    const amountUsdCents = Math.round(amountIn * 100);
    const limitCheck = await (0, kycService_1.checkAndUpdateLimit)(sender, amountUsdCents);
    if (!limitCheck.ok) {
        return res.status(403).json({ success: false, error: `KYC/limit check failed: ${limitCheck.reason}` });
    }
    const order = await (0, remittanceService_1.createOrder)({ sender, recipient, assetSymbol, amountIn, deliveryMode });
    return res.status(201).json({ success: true, data: serializeOrder(order) });
});
router.get('/', async (req, res) => {
    const orderId = readOrderId(req);
    if (!orderId) {
        return res.status(400).json({ success: false, error: 'orderId is required' });
    }
    const order = await (0, remittanceService_1.getOrder)(orderId);
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const serialized = serializeOrder(order);
    return res.json({
        success: true,
        data: serialized,
        orderId: serialized.orderId,
        status: serialized.contractStatus,
        txHash: serialized.txHash,
        utrNumber: serialized.utrNumber,
        amount: serialized.amount,
        currency: serialized.currency,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        etaSeconds: serialized.contractStatus === 'COMPLETED' ? 0 : 22,
    });
});
router.get('/sender/:address', async (req, res) => {
    const orders = (await (0, remittanceService_1.listOrdersBySender)(req.params.address)).map(serializeOrder);
    return res.json({ success: true, data: orders, count: orders.length });
});
router.get('/:id', async (req, res) => {
    const order = await (0, remittanceService_1.getOrder)(req.params.id);
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, data: serializeOrder(order) });
});
router.patch('/:id/confirm', async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const order = await (0, remittanceService_1.confirmSettlement)(req.params.id, parsed.data.utrNumber);
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, data: serializeOrder(order) });
});
router.patch('/:id/status', async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const order = await (0, remittanceService_1.updateOrderStatus)(req.params.id, parsed.data.status, {
        type: parsed.data.eventType ?? 'STATUS_UPDATE',
        message: parsed.data.message ?? `Status updated to ${parsed.data.status}`,
    });
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, data: serializeOrder(order) });
});
exports.default = router;
