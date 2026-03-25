"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fxOracle_1 = require("../services/fxOracle");
const router = (0, express_1.Router)();
router.get('/fx/usdinr', async (_req, res) => {
    const { rate, sources, cached } = await (0, fxOracle_1.getUsdInrRate)();
    return res.json({
        success: true,
        data: {
            pair: 'USD/INR',
            rate,
            rateOnChain: (0, fxOracle_1.getRateMultiplied)(rate), // rate * 10^6 for pallet_rate_lock
            sources,
            cached,
            timestamp: new Date().toISOString(),
            circuitBreaker: 'active',
            deviationLimit: '5%',
        },
    });
});
exports.default = router;
