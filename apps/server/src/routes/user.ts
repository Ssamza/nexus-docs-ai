import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth";

const router: ExpressRouter = Router();

router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ plan: user.plan, email: user.email, name: user.name });
});

export default router;
