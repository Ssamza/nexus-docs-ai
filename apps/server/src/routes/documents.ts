import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma";
import { deleteFile } from "../lib/storage";
import { getSignedDownloadUrl } from "../lib/storage";
import { requireAuth } from "../middleware/auth";

const router: ExpressRouter = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  const documents = await prisma.document.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      fileSize: true,
      mimeType: true,
      lastSyncedAt: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ documents });
});

router.get("/:id/download", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;

  const document = await prisma.document.findFirst({
    where: { id, userId: user.id },
  });

  if (!document || !document.fileKey) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const url = await getSignedDownloadUrl(document.fileKey);
  res.json({ url });
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.id as string;

  const document = await prisma.document.findFirst({
    where: { id, userId: user.id },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (document.fileKey) {
    await deleteFile(document.fileKey);
  }

  await prisma.document.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
