/**
 * Script para cargar documentos legales colombianos al sistema.
 * Uso: cd apps/server && pnpm run ingest-legal
 *
 * Conecta directamente a Prisma y Voyage AI — no requiere el servidor corriendo.
 * Coloca los PDFs en la carpeta /legal-docs antes de ejecutar.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import { prisma } from "../apps/server/src/lib/prisma";
import { chunkText, embedBatch } from "../apps/server/src/lib/embeddings";

const DOCS_DIR = path.join(__dirname, "../legal-docs");

async function ingestFile(filePath: string) {
  const filename = path.basename(filePath, ".pdf");
  console.log(`\nProcesando: ${filename}...`);

  const buffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(buffer);
  // Remove null bytes and other control characters PostgreSQL rejects
  const content = parsed.text?.replace(/\x00/g, "").trim();

  if (!content) {
    console.log(`⚠️  Sin texto: ${filename}`);
    return;
  }

  // Upsert document
  const existing = await prisma.document.findFirst({
    where: { title: filename, isPublicKnowledge: true },
  });
  const document = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: { content, lastSyncedAt: new Date() },
      })
    : await prisma.document.create({
        data: { title: filename, content, isPublicKnowledge: true },
      });

  // Re-embed
  await prisma.documentChunk.deleteMany({ where: { documentId: document.id } });

  const chunks = chunkText(content);
  console.log(`  Embediendo ${chunks.length} fragmentos en ${Math.ceil(chunks.length / 128)} llamada(s)...`);
  const embeddings = await embedBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
      VALUES (gen_random_uuid()::text, ${document.id}, ${chunks[i]}, ${JSON.stringify(embeddings[i])}::vector, ${i}, NOW())
    `;
  }

  console.log(`✓ ${filename} — ${chunks.length} fragmentos indexados`);
}

async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error("Carpeta /legal-docs no encontrada.");
    process.exit(1);
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".pdf"));

  if (files.length === 0) {
    console.log("No hay PDFs en /legal-docs.");
    process.exit(0);
  }

  console.log(`Encontrados ${files.length} documentos. Iniciando ingesta...`);

  for (const file of files) {
    await ingestFile(path.join(DOCS_DIR, file));
  }

  await prisma.$disconnect();
  console.log("\n✓ Ingesta completa.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
