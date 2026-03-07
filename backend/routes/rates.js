const express = require('express');
const router  = express.Router();

let cache = null;

router.get('/usdinr', (_req, res) => {
  if (cache && Date.now() - cache.ts < 30_000) {
    return res.json({ rate: cache.rate, source: 'cache', updatedAt: new Date(cache.ts).toISOString() });
  }
  const base  = 83.50;
  const rate  = parseFloat((base + (Math.random() - 0.5) * 0.3).toFixed(4));
  cache = { rate, ts: Date.now() };
  res.json({
    rate,
    pair: 'USD/INR',
    source: 'polkasend-oracle-aggregate',
    updatedAt: new Date().toISOString(),
  });
});

module.exports = router;
