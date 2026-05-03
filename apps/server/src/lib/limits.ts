import { Plan } from "../generated/prisma/client";

const IS_DEV = process.env.NODE_ENV !== "production";

export const PLAN_LIMITS = {
  [Plan.FREE]: {
    maxDocuments: IS_DEV ? 500 : 1,
    maxFileSizeBytes: IS_DEV ? 500 * 1024 * 1024 : 5 * 1024 * 1024,
    maxPromptsPerMonth: IS_DEV ? 9999 : 5,
    scannedOcrEnabled: false,
  },
  [Plan.REGISTERED]: {
    maxDocuments: IS_DEV ? 500 : 5,
    maxFileSizeBytes: IS_DEV ? 500 * 1024 * 1024 : 20 * 1024 * 1024,
    maxPromptsPerMonth: IS_DEV ? 9999 : 20,
    scannedOcrEnabled: false,
  },
  [Plan.PREMIUM]: {
    maxDocuments: IS_DEV ? 500 : Infinity,
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxPromptsPerMonth: IS_DEV ? 9999 : 100,
    scannedOcrEnabled: true,
  },
} as const;
