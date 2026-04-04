import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerk } from "./middleware/auth";
import { setupStorage } from "./lib/setupStorage";
import ingestRoutes from "./routes/ingest";
import queryRoutes from "./routes/query";
import documentRoutes from "./routes/documents";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.WEB_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(clerk);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ingest", ingestRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/documents", documentRoutes);

app.listen(PORT, async () => {
  await setupStorage();
  console.log(`Server running at http://localhost:${PORT}`);
});
