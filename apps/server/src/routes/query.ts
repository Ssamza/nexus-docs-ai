import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma";
import { embedText } from "../lib/embeddings";
import { generateAnswer } from "../lib/claude";
import { resolveIdentity } from "../middleware/auth";
import { MessageRole } from "../generated/prisma/client";

const router: ExpressRouter = Router();

// Minimum similarity for public legal knowledge base
const SIMILARITY_THRESHOLD = 0.60;
// Semantic cache: queries with cosine similarity above this are considered the same question
const CACHE_HIT_THRESHOLD = 0.95;
// Max messages to include as conversation history
const HISTORY_WINDOW = 8;

router.post("/", resolveIdentity, async (req: Request, res: Response) => {
  let user = (req as any).user;
  const anonId = (req as any).anonId;
  const limits = (req as any).limits;
  const { query, conversationId } = req.body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  if (query.length > 2000) {
    res.status(400).json({ error: "La pregunta no puede superar los 2000 caracteres" });
    return;
  }

  // Accept both UUID and cuid formats (Prisma uses cuid by default)
  const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  if (conversationId && !SAFE_ID_RE.test(conversationId)) {
    res.status(400).json({ error: "Invalid conversationId" });
    return;
  }

  // Enforce monthly prompt limit
  if (limits.maxPromptsPerMonth !== Infinity) {
    const now = new Date();

    if (user) {
      const needsReset =
        user.promptsResetAt.getMonth() !== now.getMonth() ||
        user.promptsResetAt.getFullYear() !== now.getFullYear();

      if (needsReset) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { promptsThisMonth: 0, promptsResetAt: now },
        });
        (req as any).user = user;
      }

      if (user.promptsThisMonth >= limits.maxPromptsPerMonth) {
        res.status(429).json({
          error: `Límite mensual alcanzado. Tu plan permite ${limits.maxPromptsPerMonth} preguntas por mes.`,
          promptsUsed: user.promptsThisMonth,
          promptsLimit: limits.maxPromptsPerMonth,
        });
        return;
      }
    } else {
      let anonUsage = await prisma.anonUsage.upsert({
        where: { anonId },
        create: { anonId, promptsThisMonth: 0, promptsResetAt: now },
        update: {},
      });

      const needsReset =
        anonUsage.promptsResetAt.getMonth() !== now.getMonth() ||
        anonUsage.promptsResetAt.getFullYear() !== now.getFullYear();

      if (needsReset) {
        anonUsage = await prisma.anonUsage.update({
          where: { anonId },
          data: { promptsThisMonth: 0, promptsResetAt: now },
        });
      }

      if (anonUsage.promptsThisMonth >= limits.maxPromptsPerMonth) {
        res.status(429).json({
          error: `Límite mensual alcanzado. Crea una cuenta gratuita para obtener más preguntas.`,
          promptsUsed: anonUsage.promptsThisMonth,
          promptsLimit: limits.maxPromptsPerMonth,
        });
        return;
      }

      (req as any).anonUsage = anonUsage;
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

  type ChunkRow = { id: string; content: string; documentId: string; similarity: number };

  // Legal knowledge base — filtered by similarity threshold
  const legalChunks = await prisma.$queryRaw<ChunkRow[]>`
    SELECT dc.id, dc.content, dc."documentId",
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."isPublicKnowledge" = true
      AND 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT 4
  `;


  // Personal documents — always included (user explicitly uploaded them to ask about them)
  const personalChunks = hasPersonalDocs
    ? user
      ? await prisma.$queryRaw<ChunkRow[]>`
          SELECT dc.id, dc.content, dc."documentId",
            1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
          FROM "DocumentChunk" dc
          JOIN "Document" d ON d.id = dc."documentId"
          WHERE d."userId" = ${user.id} AND d."isPublicKnowledge" = false
          ORDER BY dc.embedding <=> ${vectorStr}::vector
          LIMIT 4
        `
      : await prisma.$queryRaw<ChunkRow[]>`
          SELECT dc.id, dc.content, dc."documentId",
            1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
          FROM "DocumentChunk" dc
          JOIN "Document" d ON d.id = dc."documentId"
          WHERE d."anonId" = ${anonId} AND d."isPublicKnowledge" = false
          ORDER BY dc.embedding <=> ${vectorStr}::vector
          LIMIT 4
        `
    : [];


  const chunks = [...personalChunks, ...legalChunks];

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

  // Increment monthly prompt counter
  if (limits.maxPromptsPerMonth !== Infinity) {
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { promptsThisMonth: { increment: 1 } },
      });
    } else {
      await prisma.anonUsage.update({
        where: { anonId },
        data: { promptsThisMonth: { increment: 1 } },
      });
    }
  }

  // Return only metadata — never expose raw chunk text to the client
  const sources = chunks.map(({ id, documentId, similarity }) => ({ id, documentId, similarity }));
  res.json({ answer, sources, conversationId: conversation.id });
});

export default router;
