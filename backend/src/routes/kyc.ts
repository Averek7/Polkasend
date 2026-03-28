import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getKycRecord, setKycRecord, KycLevel } from '../services/kycService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get('/:address', asyncHandler(async (req: Request, res: Response) => {
  const record = await getKycRecord(req.params.address);
  if (!record) {
    return res.json({ success: true, data: { level: 'NONE', address: req.params.address } });
  }
  return res.json({ success: true, data: record });
}));

const ApproveSchema = z.object({
  address: z.string().min(10),
  level: z.enum(['BASIC_KYC', 'FULL_KYC', 'INSTITUTIONAL']),
  countryCode: z.string().length(2),
});

router.post('/approve', asyncHandler(async (req: Request, res: Response) => {
  const parsed = ApproveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const record = await setKycRecord(parsed.data.address, parsed.data.level as KycLevel, parsed.data.countryCode);
  return res.json({ success: true, data: record });
}));

export default router;
