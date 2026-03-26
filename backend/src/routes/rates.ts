import { Router, Request, Response } from 'express';
import { getUsdInrRate, getRateMultiplied } from '../services/fxOracle';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { rate, sources, cached } = await getUsdInrRate();

  return res.json({
    success: true,
    data: {
      rate,
      pair: 'USD/INR',
      source: cached ? 'cache' : 'polkasend-oracle-aggregate',
      sources,
      rateScaled: getRateMultiplied(rate),
      updatedAt: new Date().toISOString(),
      cached,
    },
  });
});

export default router;
