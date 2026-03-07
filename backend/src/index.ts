import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "dotenv";

config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", version: "0.1.0", chain: "polkasend-para-3000" });
});

// Routes mounted here in full implementation
// app.use("/api/fx", fxRouter);
// app.use("/api/kyc", kycRouter);
// app.use("/api/remittance", remittanceRouter);

app.listen(PORT, () => {
  console.log(`PolkaSend backend running on port ${PORT}`);
});

export { app };
