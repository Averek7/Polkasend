// backend/routes/kyc.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

const kycStore = new Map();

router.post('/submit', (req, res) => {
  const { address, level, aadhaarNumber, panNumber, countryCode } = req.body;
  if (!address || !level) return res.status(400).json({ error: 'Missing fields' });

  const aadhaarHash = aadhaarNumber
    ? crypto.createHash('sha256').update(aadhaarNumber).digest('hex')
    : null;
  const panHash = panNumber
    ? crypto.createHash('sha256').update(panNumber.toUpperCase()).digest('hex')
    : null;

  const limits = { BasicKyc: 250_000, FullKyc: 25_000_000, InstitutionalKyc: 1_000_000_000 };
  kycStore.set(address, { address, level, aadhaarHash, panHash, countryCode, status: 'PendingApproval', createdAt: Date.now() });

  // Auto-approve after 2s (demo)
  setTimeout(() => {
    const rec = kycStore.get(address);
    if (rec) kycStore.set(address, { ...rec, status: 'Approved', approvedAt: Date.now(), annualLimitUsdCents: limits[level] });
  }, 2000);

  res.json({ success: true, address, level, aadhaarHash, panHash, status: 'PendingApproval' });
});

router.get('/:address', (req, res) => {
  const rec = kycStore.get(req.params.address);
  if (!rec) return res.json({ level: 'None', status: 'NotFound' });
  res.json(rec);
});

module.exports = router;
