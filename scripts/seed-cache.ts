/**
 * Pre-popula el QueryCache con respuestas a preguntas legales frecuentes
 * usando el Batch API de Anthropic (50% más barato que el API estándar).
 *
 * Flujo:
 *   1. Embede cada pregunta con Voyage AI
 *   2. Recupera los chunks relevantes del DB (igual que /api/query)
 *   3. Filtra preguntas que ya tienen un hit en el cache
 *   4. Envía las restantes al Batch API
 *   5. Hace polling hasta que el batch termina
 *   6. Inserta cada respuesta en QueryCache
 *
 * Uso: cd apps/server && pnpm run seed-cache
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../apps/server/src/lib/prisma";
import { embedText } from "../apps/server/src/lib/embeddings";
import { SYSTEM_PROMPT } from "../apps/server/src/lib/claude";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SIMILARITY_THRESHOLD = 0.65;
const CACHE_HIT_THRESHOLD = 0.95;
const POLL_INTERVAL_MS = 30_000;

// Preguntas frecuentes de derecho laboral, tributario y seguridad social colombiana
const QUESTIONS = [
  // Laboral — liquidación y terminación
  "¿Cuánto es la liquidación cuando me despiden sin justa causa?",
  "¿Qué incluye la liquidación por terminación de contrato de trabajo?",
  "¿Cuánto tiempo tiene el empleador para pagar la liquidación después de terminar el contrato?",
  "¿Cuáles son las causas de despido con justa causa en Colombia?",
  // Laboral — prestaciones sociales
  "¿Cómo se calcula el auxilio de cesantías en Colombia?",
  "¿Qué es el interés sobre cesantías y cuándo se debe pagar?",
  "¿Cómo se calcula la prima de servicios y cuándo se paga?",
  "¿Cuántos días de vacaciones corresponden por año trabajado?",
  // Laboral — jornada y contrato
  "¿Cuántas horas semanales es la jornada laboral máxima en Colombia con la Ley 2101?",
  "¿Qué derechos tiene un trabajador durante el período de prueba?",
  "¿Qué diferencia hay entre un contrato a término fijo e indefinido?",
  // Laboral — acoso y seguridad
  "¿Qué es el acoso laboral según la Ley 1010 de 2006 y qué conductas incluye?",
  "¿Qué pasa si el empleador no consigna las cesantías en el fondo a tiempo?",
  // Tributario — declaración de renta
  "¿Quiénes están obligados a declarar renta en Colombia como personas naturales?",
  "¿Cuál es el tope de ingresos para que un asalariado no esté obligado a declarar renta?",
  "¿Qué gastos son deducibles en la declaración de renta de personas naturales?",
  "¿Cómo se calcula el impuesto de renta para personas naturales en Colombia?",
  // Tributario — retención y reforma
  "¿Cómo funciona la retención en la fuente sobre salarios?",
  "¿Qué cambios principales introdujo la Ley 2277 de 2022 en el impuesto de renta?",
  // Seguridad social — pensión
  "¿Qué es el sistema de pilares pensional de la Ley 2381 de 2024?",
  "¿Cuál es el porcentaje de cotización a pensión en Colombia y cómo se distribuye?",
];

interface QuestionWithContext {
  question: string;
  embedding: number[];
  context: string;
}

async function buildContext(question: string, embedding: number[]): Promise<string> {
  const vectorStr = JSON.stringify(embedding);
  const chunks = await prisma.$queryRaw<{ content: string }[]>`
    SELECT dc.content
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."isPublicKnowledge" = true
      AND 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT 6
  `;
  return chunks.map((c) => c.content).join("\n\n---\n\n");
}

async function isAlreadyCached(embedding: number[]): Promise<boolean> {
  const vectorStr = JSON.stringify(embedding);
  const hits = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "QueryCache"
    WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${CACHE_HIT_THRESHOLD}
    LIMIT 1
  `;
  return hits.length > 0;
}

async function main() {
  console.log(`\nPreparando ${QUESTIONS.length} preguntas...\n`);

  // Step 1: Embed each question and retrieve relevant chunks
  const candidates: QuestionWithContext[] = [];
  for (const question of QUESTIONS) {
    process.stdout.write(`  Procesando: ${question.slice(0, 60)}... `);
    const embedding = await embedText(question);
    const context = await buildContext(question, embedding);

    if (!context) {
      console.log("sin contexto, omitida.");
      continue;
    }

    const cached = await isAlreadyCached(embedding);
    if (cached) {
      console.log("ya en caché.");
      continue;
    }

    candidates.push({ question, embedding, context });
    console.log("pendiente.");
  }

  if (candidates.length === 0) {
    console.log("\nTodas las preguntas ya están en caché. Nada que procesar.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nEnviando ${candidates.length} preguntas al Batch API...`);

  // Step 2: Submit batch — 50% cheaper than standard API
  const batch = await anthropic.messages.batches.create({
    requests: candidates.map((item, i) => ({
      custom_id: `q-${i}`,
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text" as const,
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [
          {
            role: "user" as const,
            content: `<documents>\n${item.context}\n</documents>\n\nPregunta del usuario: ${item.question}`,
          },
        ],
      },
    })),
  });

  console.log(`Batch creado: ${batch.id}`);
  console.log("Esperando resultados (puede tardar hasta 1 hora)...\n");

  // Step 3: Poll until batch ends
  let current = batch;
  while (current.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    current = await anthropic.messages.batches.retrieve(batch.id);
    const { succeeded, processing } = current.request_counts;
    console.log(`  Estado: ${current.processing_status} — ${succeeded} completadas, ${processing} en proceso`);
  }

  console.log(`\nBatch completado. Insertando en QueryCache...\n`);

  // Step 4: Process results and insert into QueryCache
  let inserted = 0;
  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    if (result.result.type !== "succeeded") {
      console.log(`  ✗ Error en ${result.custom_id}: ${result.result.type}`);
      continue;
    }

    const idx = parseInt(result.custom_id.replace("q-", ""), 10);
    const item = candidates[idx];
    const block = result.result.message.content[0];
    if (block.type !== "text") continue;

    const vectorStr = JSON.stringify(item.embedding);
    await prisma.$executeRaw`
      INSERT INTO "QueryCache" (id, query, answer, embedding, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${item.question}, ${block.text}, ${vectorStr}::vector, NOW(), NOW())
    `;

    inserted++;
    console.log(`  ✓ ${item.question.slice(0, 70)}`);
  }

  console.log(`\n✓ Listo. ${inserted} respuestas insertadas en QueryCache.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
