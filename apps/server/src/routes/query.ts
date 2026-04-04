import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma";
import { embedText } from "../lib/embeddings";
import { generateAnswer } from "../lib/claude";
import { resolveIdentity } from "../middleware/auth";
import { MessageRole } from "../generated/prisma/client";

const router: ExpressRouter = Router();

// Minimum similarity to include a chunk as context
const SIMILARITY_THRESHOLD = 0.65;
// Semantic cache: queries with cosine similarity above this are considered the same question
const CACHE_HIT_THRESHOLD = 0.95;
// Max messages to include as conversation history
const HISTORY_WINDOW = 8;

router.post("/", resolveIdentity, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const anonId = (req as any).anonId;
  const limits = (req as any).limits;
  const { query, conversationId } = req.body;

  if (!query) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  // Enforce daily question limit
  if (limits.maxQuestionsPerDay !== Infinity) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = user
      ? await prisma.message.count({
          where: {
            role: MessageRole.USER,
            createdAt: { gte: startOfDay },
            conversation: { userId: user.id },
          },
        })
      : await prisma.message.count({
          where: {
            role: MessageRole.USER,
            createdAt: { gte: startOfDay },
            conversation: { anonId },
          },
        });

    if (todayCount >= limits.maxQuestionsPerDay) {
      res.status(429).json({
        error: `Límite diario alcanzado. Tu plan permite ${limits.maxQuestionsPerDay} preguntas por día.`,
      });
      return;
    }
  }

  // Embed the query once — used for cache lookup, vector search, and cache storage
  const queryEmbedding = await embedText(query);
  const vectorStr = JSON.stringify(queryEmbedding);

  // --- Semantic cache lookup ---
  // Only applicable for pure legal questions (no personal docs in play)
  // Skip cache if user has personal documents that might be relevant
  const hasPersonalDocs = user
    ? await prisma.document.count({ where: { userId: user.id } })
    : await prisma.document.count({ where: { anonId: anonId ?? "__none__" } });

  let cachedAnswer: string | null = null;
  let cacheId: string | null = null;

  if (!hasPersonalDocs) {
    const cacheHits = await prisma.$queryRaw<{ id: string; answer: string; similarity: number }[]>`
      SELECT id, answer,
        1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "QueryCache"
      WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${CACHE_HIT_THRESHOLD}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 1
    `;

    if (cacheHits.length > 0) {
      cachedAnswer = cacheHits[0].answer;
      cacheId = cacheHits[0].id;
    }
  }

  // Resolve or create conversation
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: user
        ? { id: conversationId, userId: user.id }
        : { id: conversationId, anonId },
    });
  }
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user?.id ?? null,
        anonId: user ? null : anonId,
        title: query.slice(0, 80),
      },
    });
  }

  // Save user message
  await prisma.message.create({
    data: { conversationId: conversation.id, role: MessageRole.USER, content: query },
  });

  // --- Cache hit: skip vector search and Claude ---
  if (cachedAnswer) {
    await prisma.$executeRaw`
      UPDATE "QueryCache" SET "hitCount" = "hitCount" + 1, "updatedAt" = NOW()
      WHERE id = ${cacheId}
    `;

    await prisma.message.create({
      data: { conversationId: conversation.id, role: MessageRole.ASSISTANT, content: cachedAnswer },
    });

    res.json({ answer: cachedAnswer, sources: [], conversationId: conversation.id, cached: true });
    return;
  }

  // Fetch conversation history (last HISTORY_WINDOW messages = 4 turns)
  const historyRows = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
    select: { role: true, content: true },
  });
  const history = historyRows.reverse().map((m) => ({
    role: m.role === MessageRole.USER ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  // Vector search with similarity filter
  const rawChunks = user
    ? await prisma.$queryRaw<{ id: string; content: string; documentId: string; similarity: number }[]>`
        SELECT dc.id, dc.content, dc."documentId",
          1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE d."isPublicKnowledge" = true OR d."userId" = ${user.id}
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT 6
      `
    : await prisma.$queryRaw<{ id: string; content: string; documentId: string; similarity: number }[]>`
        SELECT dc.id, dc.content, dc."documentId",
          1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE d."isPublicKnowledge" = true OR d."anonId" = ${anonId}
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT 6
      `;

  // Filter out chunks below the similarity threshold
  const chunks = rawChunks.filter((c) => Number(c.similarity) >= SIMILARITY_THRESHOLD);

  if (chunks.length === 0) {
    const fallback = "No encontré información relevante en los documentos disponibles para responder esa pregunta.";
    await prisma.message.create({
      data: { conversationId: conversation.id, role: MessageRole.ASSISTANT, content: fallback },
    });
    res.json({ answer: fallback, sources: [], conversationId: conversation.id });
    return;
  }

  const answer = await generateAnswer(query, chunks.map((c) => c.content), history);

  // Save assistant message
  await prisma.message.create({
    data: { conversationId: conversation.id, role: MessageRole.ASSISTANT, content: answer },
  });

  // Store in semantic cache (only pure legal queries — no personal docs)
  if (!hasPersonalDocs) {
    await prisma.$executeRaw`
      INSERT INTO "QueryCache" (id, query, answer, embedding, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${query}, ${answer}, ${vectorStr}::vector, NOW(), NOW())
    `;
  }

  res.json({ answer, sources: chunks, conversationId: conversation.id });
});

export default router;
