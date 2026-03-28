import { Router, Request, Response } from 'express';
import { getUsdInrRate, getRateMultiplied } from '../services/fxOracle';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get('/fx/usdinr', asyncHandler(async (_req: Request, res: Response) => {
  const { rate, sources, cached } = await getUsdInrRate();
  return res.json({
    success: true,
    data: {
      pair:           'USD/INR',
      rate,
      rateOnChain:    getRateMultiplied(rate),  // rate * 10^6 for pallet_rate_lock
      sources,
      cached,
      timestamp:      new Date().toISOString(),
      circuitBreaker: 'active',
      deviationLimit: '5%',
    },
  });
}));

export default router;
