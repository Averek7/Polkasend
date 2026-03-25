"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ─── routes/health.ts ─────────────────────────────────────────────
const express_1 = require("express");
exports.default = (0, express_1.Router)().get('/', (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'PolkaSend API', ts: new Date().toISOString() });
});
