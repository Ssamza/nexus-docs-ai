import { Request, Response, NextFunction, RequestHandler } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { PLAN_LIMITS } from "../lib/limits";
import { Plan } from "../generated/prisma/client";

export const clerk: RequestHandler = clerkMiddleware();

// Resolves identity from Clerk JWT or anonymous cookie
// Attaches req.user (if logged in) or req.anonId (if anonymous)
export async function resolveIdentity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId: clerkId } = getAuth(req);

  if (clerkId) {
    let user = await prisma.user.findUnique({ where: { clerkId } });

    if (!user) {
      const claims = (req as any).auth?.sessionClaims;
      user = await prisma.user.create({
        data: {
          clerkId,
          email: claims?.email ?? `${clerkId}@unknown.com`,
          name: claims?.name ?? null,
        },
      });
    }

    (req as any).user = user;
    (req as any).limits = PLAN_LIMITS[user.plan as Plan];
  } else {
    const anonId = req.headers["x-anon-id"] as string | undefined;

    if (!anonId) {
      res.status(401).json({ error: "Missing identity" });
      return;
    }

    (req as any).anonId = anonId;
    (req as any).limits = PLAN_LIMITS.ANONYMOUS;
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
