import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerk } from "./middleware/auth";
import { setupStorage } from "./lib/setupStorage";
import ingestRoutes from "./routes/ingest";
import queryRoutes from "./routes/query";
import documentRoutes from "./routes/documents";
import userRoutes from "./routes/user";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_URL || "http://localhost:3000" }));
// Limit JSON body to 1 MB — file uploads use multipart, not JSON
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
  })
);
app.use(clerk);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ingest", ingestRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/user", userRoutes);

// Global error handler — prevents stack traces from leaking to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, async () => {
  if (process.env.MINIO_ENDPOINT) {
    await setupStorage();
  }
  console.log(`Server running at http://localhost:${PORT}`);
});
