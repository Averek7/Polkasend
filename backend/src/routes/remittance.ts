import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createOrder,
  getOrder,
  listOrdersBySender,
  updateOrderStatus,
  confirmSettlement,
} from '../services/remittanceService';
import { checkAndUpdateLimit, amlScreen } from '../services/kycService';

const router = Router();

// ─── POST /api/remittance — Create order ─────────────────────────
const CreateSchema = z.object({
  sender:       z.string().min(10),
  recipient:    z.string().min(3),
  assetSymbol:  z.enum(['USDC', 'USDT', 'DAI']),
  amountIn:     z.number().positive().max(250_000),
  deliveryMode: z.enum(['UPI_INSTANT', 'IMPS_NEFT', 'IINR_WALLET', 'AADHAAR_PAY']),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { sender, recipient, assetSymbol, amountIn, deliveryMode } = parsed.data;

  // AML screen
  const aml = amlScreen(sender);
  if (!aml.pass) {
    return res.status(403).json({ success: false, error: `AML check failed: ${aml.reason}` });
  }

  // KYC + limit check (amount in USD cents)
  const amountUsdCents = Math.round(amountIn * 100);
  const limitCheck = checkAndUpdateLimit(sender, amountUsdCents);
  if (!limitCheck.ok) {
    return res.status(403).json({ success: false, error: `KYC/limit check failed: ${limitCheck.reason}` });
  }

  const order = await createOrder({ sender, recipient, assetSymbol, amountIn, deliveryMode });
  return res.status(201).json({ success: true, data: order });
});

// ─── GET /api/remittance?orderId=... — frontend polling shape ────
router.get('/', (req: Request, res: Response) => {
  const orderId = req.query.orderId as string | undefined;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required' });
  }
  const order = getOrder(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  return res.json({
    orderId: order.id,
    status: order.status,
    txHash: order.txHash ?? null,
    utrNumber: order.utrNumber ?? null,
    amount: order.amountIn,
    currency: order.assetSymbol,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    etaSeconds: order.status === 'COMPLETED' ? 0 : 22,
  });
});

// ─── GET /api/remittance/sender/:address ─────────────────────────
router.get('/sender/:address', (req: Request, res: Response) => {
  const orders = listOrdersBySender(req.params.address);
  return res.json({ success: true, data: orders, count: orders.length });
});

// ─── GET /api/remittance/:id — explicit lookup ───────────────────
router.get('/:id', (req: Request, res: Response) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  return res.json({ success: true, data: order });
});

// ─── PATCH /api/remittance/:id/confirm — Oracle confirms settlement ──
router.patch('/:id/confirm', (req: Request, res: Response) => {
  const { utrNumber } = req.body;
  if (!utrNumber) {
    return res.status(400).json({ success: false, error: 'utrNumber required' });
  }
  const order = confirmSettlement(req.params.id, utrNumber);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  return res.json({ success: true, data: order });
});

// ─── PATCH /api/remittance/:id/status ────────────────────────────
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status, eventType, message } = req.body;
  const order = updateOrderStatus(req.params.id, status, {
    type: eventType || 'STATUS_UPDATE',
    message: message || `Status updated to ${status}`,
  });
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  return res.json({ success: true, data: order });
});

export default router;
