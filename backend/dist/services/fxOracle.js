"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsdInrRate = getUsdInrRate;
exports.getRateMultiplied = getRateMultiplied;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../config/logger");
let cache = null;
const CACHE_TTL_MS = 30_000; // 30 second cache
const RATE_SOURCES = [
    {
        name: 'exchangerate.host',
        url: 'https://api.exchangerate.host/latest?base=USD&symbols=INR',
        parse: (d) => d?.rates?.INR,
    },
    {
        name: 'open.er-api.com',
        url: 'https://open.er-api.com/v6/latest/USD',
        parse: (d) => d?.rates?.INR,
    },
    {
        name: 'frankfurter.app',
        url: 'https://api.frankfurter.app/latest?from=USD&to=INR',
        parse: (d) => d?.rates?.INR,
    },
];
async function fetchFromSource(source) {
    try {
        const res = await axios_1.default.get(source.url, { timeout: 3000 });
        const rate = source.parse(res.data);
        if (typeof rate === 'number' && rate > 0)
            return rate;
        return null;
    }
    catch (err) {
        logger_1.logger.warn(`FX source ${source.name} failed: ${err.message}`);
        return null;
    }
}
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
async function getUsdInrRate() {
    // Return cache if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
        return { rate: cache.rate, sources: cache.sources, cached: true };
    }
    const results = await Promise.allSettled(RATE_SOURCES.map(fetchFromSource));
    const rates = [];
    const successSources = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value !== null) {
            rates.push(result.value);
            successSources.push(RATE_SOURCES[i].name);
        }
    });
    if (rates.length === 0) {
        // Fallback to cached value or hardcoded fallback
        if (cache) {
            logger_1.logger.warn('All FX sources failed, using stale cache');
            return { rate: cache.rate, sources: ['stale-cache'], cached: true };
        }
        logger_1.logger.warn('All FX sources failed, using hardcoded fallback rate');
        return { rate: 83.50, sources: ['fallback'], cached: false };
    }
    // Circuit breaker: reject if any rate deviates > 5% from median
    const med = median(rates);
    const validRates = rates.filter((r, i) => Math.abs(r - med) / med <= 0.05);
    const finalRate = parseFloat(median(validRates.length > 0 ? validRates : rates).toFixed(4));
    cache = { rate: finalRate, timestamp: Date.now(), sources: successSources };
    logger_1.logger.info(`FX rate updated: ₹${finalRate} (sources: ${successSources.join(', ')})`);
    return { rate: finalRate, sources: successSources, cached: false };
}
function getRateMultiplied(rate) {
    // On-chain representation: rate * 10^6
    return Math.round(rate * 1_000_000);
}
