const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory store for demo (replace with MongoDB in prod)
const orders = new Map();

// POST /api/remittance/initiate
router.post('/initiate', async (req, res) => {
  try {
    const { senderAddress, recipientId, amount, currency, deliveryMode } = req.body;

    if (!senderAddress || !recipientId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const fxRate   = 83.50 + (Math.random() - 0.5) * 0.3;
    const fee      = amount * 0.005;
    const netAmt   = amount - fee;
    const inrPaise = Math.round(netAmt * fxRate * 100);
    const orderId  = uuidv4();
    const txHash   = '0x' + Buffer.alloc(32).fill(Math.random() * 255).toString('hex');

    const order = {
      orderId,
      txHash,
      senderAddress,
      recipientId,
      amount,
      currency,
      deliveryMode,
      fxRateLocked: fxRate,
      amountInrPaise: inrPaise,
      feePct: 0.5,
      status: 'RateLocked',
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 min
    };

    orders.set(orderId, order);

    // Simulate async settlement
    simulateSettlement(orderId, deliveryMode);

    res.json({
      success: true,
      orderId,
      txHash,
      fxRateLocked: fxRate,
      amountInr: inrPaise / 100,
      feePct: 0.5,
      status: 'RateLocked',
    });
  } catch (err) {
    console.error('[remittance/initiate]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/remittance/order/:id
router.get('/order/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /api/remittance/history/:address
router.get('/history/:address', (req, res) => {
  const userOrders = [...orders.values()]
    .filter(o => o.senderAddress === req.params.address)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ orders: userOrders });
});

// Simulate on-chain settlement progression
function simulateSettlement(orderId, deliveryMode) {
  const steps = [
    { status: 'CompliancePassed',      delay: 1_500 },
    { status: 'SettlementTriggered',   delay: 4_000 },
    {
      status: 'Completed',
      utrNumber: 'HDFC' + Date.now().toString().slice(-12),
      delay: deliveryMode === 'iinr' ? 6_000 : deliveryMode === 'upi' ? 12_000 : 30_000,
    },
  ];

  let elapsed = 0;
  for (const step of steps) {
    elapsed += step.delay;
    setTimeout(() => {
      const order = orders.get(orderId);
      if (!order) return;
      orders.set(orderId, { ...order, ...step, delay: undefined });
    }, elapsed);
  }
}

module.exports = router;
