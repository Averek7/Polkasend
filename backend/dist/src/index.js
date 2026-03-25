"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = require("dotenv");
const health_1 = __importDefault(require("./routes/health"));
const kyc_1 = __importDefault(require("./routes/kyc"));
const quote_1 = __importDefault(require("./routes/quote"));
const remittance_1 = __importDefault(require("./routes/remittance"));
const oracle_1 = __importDefault(require("./routes/oracle"));
const rates_1 = __importDefault(require("./routes/rates"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT ?? 4000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express_1.default.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => {
    res.json({ success: true, status: "ok", version: "0.1.0", chain: "polkasend-para-3000" });
});
app.use("/api/health", health_1.default);
app.use("/api/kyc", kyc_1.default);
app.use("/api/quote", quote_1.default);
app.use("/api/rates", rates_1.default);
app.use("/api/remittance", remittance_1.default);
app.use("/api/oracle", oracle_1.default);
app.listen(PORT, () => {
    console.log(`PolkaSend backend running on port ${PORT}`);
});
