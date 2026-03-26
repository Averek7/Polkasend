import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "dotenv";
import healthRouter from "./routes/health";
import kycRouter from "./routes/kyc";
import quoteRouter from "./routes/quote";
import remittanceRouter from "./routes/remittance";
import oracleRouter from "./routes/oracle";
import ratesRouter from "./routes/rates";

config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", version: "0.1.0", chain: "polkasend-para-3000" });
});

app.use("/api/health", healthRouter);
app.use("/api/healthz", healthRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/quote", quoteRouter);
app.use("/api/rates", ratesRouter);
app.use("/api/remittance", remittanceRouter);
app.use("/api/oracle", oracleRouter);

app.listen(PORT, () => {
  console.log(`PolkaSend backend running on port ${PORT}`);
});

export { app };
