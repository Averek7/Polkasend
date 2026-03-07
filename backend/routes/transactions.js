const express = require('express');
const router  = express.Router();

// GET /api/transactions/live — simulated live feed
router.get('/live', (_req, res) => {
  const corridors = [
    { from: 'New York, USA',    to: 'Mumbai, IN' },
    { from: 'Dubai, UAE',       to: 'Kerala, IN' },
    { from: 'London, UK',       to: 'Bengaluru, IN' },
    { from: 'Toronto, Canada',  to: 'Hyderabad, IN' },
    { from: 'Singapore',        to: 'Chennai, IN' },
  ];
  const txs = Array.from({ length: 10 }, (_, i) => {
    const c   = corridors[i % corridors.length];
    const amt = +(Math.random() * 490 + 10).toFixed(2);
    const statuses = ['Completed','Completed','Completed','RateLocked','SettlementTriggered'];
    return {
      orderId: '0x' + Buffer.alloc(16).fill(Math.random() * 255).toString('hex'),
      from: c.from, to: c.to,
      amountUsdc: amt,
      amountInr: +(amt * 83.50 * 0.995).toFixed(0),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: new Date(Date.now() - i * 18_000).toISOString(),
    };
  });
  res.json({ transactions: txs });
});

module.exports = router;
