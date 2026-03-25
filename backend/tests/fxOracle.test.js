"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const axios_1 = __importDefault(require("axios"));
const fxOracle_1 = require("../src/services/fxOracle");
vitest_1.vi.mock("axios");
const mockedAxios = vitest_1.vi.mocked(axios_1.default, true);
(0, vitest_1.describe)("fxOracle", () => {
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("returns scaled rate value", () => {
        (0, vitest_1.expect)((0, fxOracle_1.getRateMultiplied)(83.5)).toBe(83_500_000);
    });
    (0, vitest_1.it)("aggregates and returns valid usd/inr rate", async () => {
        mockedAxios.get
            .mockResolvedValueOnce({ data: { rates: { INR: 83.4 } } })
            .mockResolvedValueOnce({ data: { rates: { INR: 83.5 } } })
            .mockResolvedValueOnce({ data: { rates: { INR: 83.6 } } });
        const result = await (0, fxOracle_1.getUsdInrRate)();
        (0, vitest_1.expect)(result.rate).toBeGreaterThan(80);
        (0, vitest_1.expect)(result.rate).toBeLessThan(90);
        (0, vitest_1.expect)(result.sources.length).toBeGreaterThan(0);
    });
});
