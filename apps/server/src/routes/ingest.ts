import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { prisma } from "../lib/prisma";
import { chunkText, embedBatch } from "../lib/embeddings";
import { uploadFile } from "../lib/storage";
import { resolveIdentity } from "../middleware/auth";

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.post("/document", resolveIdentity, upload.single("file"), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const anonId = (req as any).anonId;
  const limits = (req as any).limits;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  if (file.size > limits.maxFileSizeBytes) {
    res.status(400).json({
      error: `Archivo muy grande. Tu plan permite hasta ${limits.maxFileSizeBytes / 1024 / 1024}MB`,
    });
    return;
  }

  const docCount = await prisma.document.count({
    where: user ? { userId: user.id } : { anonId },
  });

  if (docCount >= limits.maxDocuments) {
    res.status(400).json({
      error: `Límite de documentos alcanzado. Tu plan permite hasta ${limits.maxDocuments} documentos`,
    });
    return;
  }

  let content = "";
  if (file.mimetype === "application/pdf") {
    const parsed = await pdfParse(file.buffer);
    content = parsed.text?.replace(/\x00/g, "") ?? "";
  } else {
    res.status(400).json({ error: "Solo se admiten archivos PDF por ahora" });
    return;
  }

  if (!content.trim()) {
    res.status(400).json({ error: "No se pudo extraer texto del archivo" });
    return;
  }

  const fileKey = `${user?.id ?? anonId}/${Date.now()}-${file.originalname}`;
  await uploadFile(fileKey, file.buffer, file.mimetype);

  const title = req.body.title || file.originalname.replace(/\.pdf$/i, "");
  const document = await prisma.document.create({
    data: {
      userId: user?.id ?? null,
      anonId: user ? null : anonId,
      title,
      content,
      fileKey,
      fileSize: file.size,
      mimeType: file.mimetype,
    },
  });

  const chunks = chunkText(content);
  const embeddings = await embedBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
      VALUES (gen_random_uuid()::text, ${document.id}, ${chunks[i]}, ${JSON.stringify(embeddings[i])}::vector, ${i}, NOW())
    `;
  }

  res.json({ documentId: document.id, chunks: chunks.length, title });
});

// n8n — ingest pre-loaded legal documents
router.post("/legal", async (req: Request, res: Response) => {
  const { title, content, secret } = req.body;

  if (secret !== process.env.INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const existing = await prisma.document.findFirst({
    where: { title, isPublicKnowledge: true },
  });
  const document = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: { content, lastSyncedAt: new Date() },
      })
    : await prisma.document.create({
        data: { title, content, isPublicKnowledge: true },
      });

  await prisma.documentChunk.deleteMany({ where: { documentId: document.id } });

  const chunks = chunkText(content);
  const embeddings = await embedBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
      VALUES (gen_random_uuid()::text, ${document.id}, ${chunks[i]}, ${JSON.stringify(embeddings[i])}::vector, ${i}, NOW())
    `;
  }

  res.json({ documentId: document.id, chunks: chunks.length });
});

export default router;
