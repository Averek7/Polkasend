require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const mongoose  = require('mongoose');

const remittanceRoutes   = require('./routes/remittance');
const kycRoutes          = require('./routes/kyc');
const ratesRoutes        = require('./routes/rates');
const transactionRoutes  = require('./routes/transactions');

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/remittance',   remittanceRoutes);
app.use('/api/kyc',          kycRoutes);
app.use('/api/rates',        ratesRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─── DB connection ────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/polkasend';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.warn('⚠️  MongoDB not available — running in memory mode');
    console.warn(err.message);
  });

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  PolkaSend Backend API
  ─────────────────────
  🚀  Listening on  http://localhost:${PORT}
  📡  Health check  http://localhost:${PORT}/health
  🔗  Polkadot RPC  ${process.env.POLKADOT_RPC ?? 'wss://rpc.polkadot.io'}
  `);
});

module.exports = app;
