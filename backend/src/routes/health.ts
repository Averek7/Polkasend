// ─── routes/health.ts ─────────────────────────────────────────────
import { Router } from 'express';
export default Router().get('/', (_req, res) => {
  res.json({ success: true, status: 'ok', service: 'PolkaSend API', ts: new Date().toISOString() });
});
