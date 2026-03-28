import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";
import healthRouter from "./routes/health";
import kycRouter from "./routes/kyc";
import quoteRouter from "./routes/quote";
import remittanceRouter from "./routes/remittance";
import oracleRouter from "./routes/oracle";
import ratesRouter from "./routes/rates";
import { requestContext } from "./middleware/requestContext";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
app.use(requestContext);

const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", version: "0.1.0", chain: "polkasend-para-3000" });
});

app.use("/api/health", healthRouter);
app.use("/api/healthz", healthRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/quote", quoteLimiter, quoteRouter);
app.use("/api/rates", ratesRouter);
app.use("/api/remittance", remittanceRouter);
app.use("/api/oracle", oracleRouter);
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`PolkaSend backend running on port ${PORT}`);
  });
}

export { app };
