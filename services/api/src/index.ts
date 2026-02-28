import "dotenv/config";

import cors from "cors";
import express from "express";

import { AuditChain } from "./audit/chain";
import { MLClient } from "./clients/mlClient";
import { buildRouter } from "./routes/index";
import { ApiStore } from "./store/store";

const app = express();

const port = Number(process.env.PORT ?? 8000);
const mlServiceUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8001";
const dataPath = process.env.DATA_PATH ?? "./data/api_store.json";
const blockchainAudit = String(process.env.BLOCKCHAIN_AUDIT ?? "true") === "true";

const store = new ApiStore(dataPath);
const mlClient = new MLClient(mlServiceUrl);
const audit = new AuditChain(blockchainAudit);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(buildRouter(store, mlClient, audit));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_server_error", message: err.message });
});

app.listen(port, () => {
  console.log(`bubbleOne API running on :${port}`);
  console.log(`ML service target: ${mlServiceUrl}`);
});
