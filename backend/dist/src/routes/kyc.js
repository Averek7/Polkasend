"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const kycService_1 = require("../services/kycService");
const router = (0, express_1.Router)();
router.get('/:address', async (req, res) => {
    const record = await (0, kycService_1.getKycRecord)(req.params.address);
    if (!record) {
        return res.json({ success: true, data: { level: 'NONE', address: req.params.address } });
    }
    return res.json({ success: true, data: record });
});
const ApproveSchema = zod_1.z.object({
    address: zod_1.z.string().min(10),
    level: zod_1.z.enum(['BASIC_KYC', 'FULL_KYC', 'INSTITUTIONAL']),
    countryCode: zod_1.z.string().length(2),
});
router.post('/approve', async (req, res) => {
    const parsed = ApproveSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const record = await (0, kycService_1.setKycRecord)(parsed.data.address, parsed.data.level, parsed.data.countryCode);
    return res.json({ success: true, data: record });
});
exports.default = router;
