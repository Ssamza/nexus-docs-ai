import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { PLAN_LIMITS } from "../lib/limits";
import { Plan } from "../generated/prisma/client";

const router: ExpressRouter = Router();

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const plan = user.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  const documentCount = await prisma.document.count({ where: { userId: user.id } });

  const nextReset = new Date(user.promptsResetAt);
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);

  res.json({
    plan,
    email: user.email,
    name: user.name,
    usage: {
      promptsUsed: user.promptsThisMonth,
      promptsLimit: limits.maxPromptsPerMonth,
      documentsUsed: documentCount,
      documentsLimit: limits.maxDocuments === Infinity ? null : limits.maxDocuments,
      resetsAt: nextReset.toISOString(),
    },
  });
});

export default router;
