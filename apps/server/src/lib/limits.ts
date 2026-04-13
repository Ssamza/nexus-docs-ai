import { Plan } from "../generated/prisma/client";

const IS_DEV = process.env.NODE_ENV !== "production";

export const PLAN_LIMITS = {
  ANONYMOUS: {
    maxDocuments: IS_DEV ? 500 : 1,
    maxFileSizeBytes: IS_DEV ? 500 * 1024 * 1024 : 5 * 1024 * 1024,
    maxQuestionsPerDay: IS_DEV ? 5 : 10,
    scannedOcrEnabled: false, // OCR for image-based scanned PDFs (requires Vision API)
  },
  [Plan.REGISTERED]: {
    maxDocuments: IS_DEV ? 500 : 5,
    maxFileSizeBytes: IS_DEV ? 500 * 1024 * 1024 : 20 * 1024 * 1024,
    maxQuestionsPerDay: IS_DEV ? 10 : 25,
    scannedOcrEnabled: false,
  },
  [Plan.PREMIUM]: {
    maxDocuments: Infinity,
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxQuestionsPerDay: Infinity,
    scannedOcrEnabled: true,
  },
} as const;
