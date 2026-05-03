import { Request, Response, NextFunction, RequestHandler } from "express";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { PLAN_LIMITS } from "../lib/limits";
import { Plan } from "../generated/prisma/client";

export const clerk: RequestHandler = clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

// Resolves identity from Clerk JWT or anonymous cookie
// Attaches req.user (if logged in) or req.anonId (if anonymous)
export async function resolveIdentity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId: clerkId } = getAuth(req);
  console.log("[auth] clerkId:", clerkId, "| Authorization:", req.headers["authorization"]?.slice(0, 30));

  if (clerkId) {
    let user = await prisma.user.findUnique({ where: { clerkId } });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkId}@unknown.com`;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
      user = await prisma.user.create({
        data: { clerkId, email, name },
      });
    }

    (req as any).user = user;
    (req as any).limits = PLAN_LIMITS[user.plan as Plan];
  } else {
    const anonId = req.headers["x-anon-id"] as string | undefined;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!anonId || !UUID_RE.test(anonId)) {
      res.status(401).json({ error: "Missing or invalid identity" });
      return;
    }

    (req as any).anonId = anonId;
    (req as any).limits = PLAN_LIMITS[Plan.FREE];
  }

  next();
}

// Requires full Clerk authentication (no anonymous)
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await resolveIdentity(req, res, () => {
    if (!(req as any).user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  });
}
