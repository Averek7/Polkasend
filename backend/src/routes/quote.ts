import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getUsdInrRate } from '../services/fxOracle';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const QuoteSchema = z.object({
  fromAsset:    z.enum(['USDC', 'USDT', 'DAI']),
  amountUsd:    z.number().positive().max(250_000),
  deliveryMode: z.enum(['UPI_INSTANT', 'IMPS_NEFT', 'IINR_WALLET', 'AADHAAR_PAY']),
});

const DELIVERY_SECONDS: Record<string, number> = {
  UPI_INSTANT:  30,
  IMPS_NEFT:    120,
  IINR_WALLET:  6,
  AADHAAR_PAY:  45,
};

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = QuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { fromAsset, amountUsd, deliveryMode } = parsed.data;
  const { rate, sources, cached } = await getUsdInrRate();

  const protocolFeeUsd = amountUsd * 0.005;
  const gasFeeUsd      = 0.05;
  const netUsd         = amountUsd - protocolFeeUsd - gasFeeUsd;
  const netAmountInr   = netUsd * rate;

  // Bank comparison (4.5% fee + 1.5% FX spread)
  const bankFeeUsd   = amountUsd * 0.06;
  const savingsInr   = (bankFeeUsd - protocolFeeUsd - gasFeeUsd) * rate;

  return res.json({
    success: true,
    data: {
      feeBreakdown: {
        grossAmountUsd:   amountUsd,
        protocolFeeUsd,
        fxSpreadUsd:      0,
        gasFeeUsd,
        netAmountInr,
        fxRate:           rate,
        savingsVsBank:    savingsInr,
      },
      fxRate: rate,
      fxRateSources: sources,
      rateCached: cached,
      rateLockExpiresAt: Date.now() + 15 * 60 * 1000,
      estimatedSettlementSeconds: DELIVERY_SECONDS[deliveryMode],
      xcmRoute: {
        from: 'Moonbeam / AssetHub',
        via:  ['Polkadot Relay Chain', 'PolkaSend Para #3000', 'Acala Para #2000'],
        to:   'India (UPI/IMPS/Aadhaar)',
        estimatedSeconds: DELIVERY_SECONDS[deliveryMode] + 12,
      },
    },
  });
}));

export default router;
