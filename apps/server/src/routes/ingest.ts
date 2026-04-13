import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import { prisma } from "../lib/prisma";
import { chunkText, embedBatch } from "../lib/embeddings";
import { uploadFile } from "../lib/storage";
import { ocrPdf } from "../lib/claude";
import { resolveIdentity } from "../middleware/auth";

// Extracts AcroForm field values — used as fallback when the text layer is empty
// (common in DIAN forms, fillable contracts, etc.)
async function extractFormFields(buffer: Buffer): Promise<string> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    if (fields.length === 0) return "";

    const lines: string[] = [];
    for (const field of fields) {
      const name = field.getName();
      let value = "";

      if (field instanceof PDFTextField) {
        value = field.getText() ?? "";
      } else if (field instanceof PDFCheckBox) {
        value = field.isChecked() ? "Sí" : "No";
      } else if (field instanceof PDFDropdown) {
        value = field.getSelected().join(", ");
      } else if (field instanceof PDFRadioGroup) {
        value = field.getSelected() ?? "";
      }

      if (value.trim()) lines.push(`${name}: ${value}`);
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.post("/document", resolveIdentity, upload.single("file"), async (req: Request, res: Response, next) => {
  try { return await handleDocumentUpload(req, res); } catch (e) { console.error("INGEST ERROR:", e); next(e); }
});

async function handleDocumentUpload(req: Request, res: Response) {
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

  // Validate magic bytes — MIME type alone can be spoofed by the client
  const isPdf =
    file.mimetype === "application/pdf" &&
    file.buffer.slice(0, 4).toString("ascii") === "%PDF";

  if (!isPdf) {
    res.status(400).json({ error: "Solo se admiten archivos PDF por ahora" });
    return;
  }

  // pdf-parse throws on some PDFs (encrypted, malformed, PDF 2.0) — treat as empty
  let content = "";
  try {
    const parsed = await pdfParse(file.buffer);
    content = parsed.text?.replace(/\x00/g, "").trim() ?? "";
  } catch {
    // fall through to next extraction method
  }

  // Fallback 1: AcroForm fields (DIAN forms, fillable contracts)
  if (!content) {
    content = await extractFormFields(file.buffer);
  }

  // Fallback 2: Claude Vision OCR for scanned/image-only PDFs (Premium only)
  if (!content) {
    if (!limits.scannedOcrEnabled) {
      res.status(400).json({
        error: "Este PDF parece ser un documento escaneado. El OCR para documentos escaneados está disponible en el plan Premium.",
      });
      return;
    }
    content = await ocrPdf(file.buffer);
  }

  if (!content) {
    res.status(400).json({ error: "No se pudo extraer texto de este PDF." });
    return;
  }

  // Sanitize filename to prevent path traversal in the S3 key
  const safeName = file.originalname
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
  const fileKey = `${user?.id ?? anonId}/${Date.now()}-${safeName}`;
  await uploadFile(fileKey, file.buffer, file.mimetype);

  const rawTitle = req.body.title || file.originalname.replace(/\.pdf$/i, "");
  const title = String(rawTitle).slice(0, 200);
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
}

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
