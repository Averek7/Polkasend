"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fxOracle_1 = require("../services/fxOracle");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const { rate, sources, cached } = await (0, fxOracle_1.getUsdInrRate)();
    return res.json({
        success: true,
        data: {
            rate,
            pair: 'USD/INR',
            source: cached ? 'cache' : 'polkasend-oracle-aggregate',
            sources,
            rateScaled: (0, fxOracle_1.getRateMultiplied)(rate),
            updatedAt: new Date().toISOString(),
            cached,
        },
    });
});
exports.default = router;
