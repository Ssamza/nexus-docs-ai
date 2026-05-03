# NexusDocs AI

Full-stack RAG platform for Colombian legal and labor law. Upload your contracts, pay stubs, and tax documents — ask questions in plain language and get answers grounded in real Colombian legislation.

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Next.js (App Router), React 19, Tailwind CSS v4, TypeScript |
| Backend | Express 5, TypeScript, ts-node/nodemon |
| Auth | Clerk (JWT + anonymous sessions) |
| ORM | Prisma 7 — output: `apps/server/src/generated/prisma` |
| Database | PostgreSQL 16 + pgvector |
| Embeddings | Voyage AI (`voyage-3-lite`, 512 dims) |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) |
| Storage | S3-compatible (MinIO locally, Cloudflare R2 in production) |

---

## Architecture

```
User
  │
  ├─ Uploads personal PDF ──────────────────────────────────┐
  │                                                          │
  └─ Asks a question                                         │
       │                                                     │
       ▼                                                     ▼
  [ Next.js ]                                        [ Express API ]
  apps/web                                           apps/server
       │                                                     │
       │  POST /api/query                   POST /api/ingest/document
       │─────────────────────────────────►        │
                                                   ▼
                                            pdf-parse (extract text)
                                                   │
                                                   ▼
                                            chunkText() ~2000 chars
                                                   │
                                                   ▼
                                            Voyage AI embeddings (512d)
                                                   │
                                                   ▼
                                            PostgreSQL + pgvector
                                            DocumentChunk.embedding
```

### Query flow

```
User submits question
        │
        ▼
Voyage AI embed(query) → 512d vector
        │
        ▼
pgvector similarity search
  WHERE isPublicKnowledge = true   ← pre-loaded legal knowledge base
     OR userId/anonId = current    ← personal documents
  ORDER BY embedding <=> query_vec
  LIMIT 6
        │
        ▼
Semantic cache lookup (cosine similarity >= 0.95)
  → cache hit: return stored answer, skip Claude
  → cache miss: continue
        │
        ▼
Claude claude-sonnet-4-6
  system: Colombian legal system prompt
  context: top-6 relevant chunks
  history: last 8 messages in thread
        │
        ▼
Answer + conversationId saved to DB
```

### Pre-loaded legal knowledge base (`/legal-docs`)

| File | Law |
|---|---|
| Código Sustantivo del Trabajo | CST (labor base) |
| Decreto 1072 de 2015 | Único Reglamentario |
| Ley 50 de 1990 | Labor reform |
| Ley 789 de 2002 | Labor reform / SENA |
| Ley 1010 de 2006 | Workplace harassment |
| Ley 2101 de 2021 | 40-hour workweek |
| Ley 100 de 1993 | Social security (health) |
| Ley 2381 de 2024 | Pension reform |
| Estatuto Tributario | Tax code |
| Ley 2277 de 2022 | Tax reform |
| Resolución 44 DIAN 2024 | Form 210 — personal income tax |
| ABC Declaración Renta 2022 | DIAN practical guide |
| Concepto Retención en la Fuente | DIAN |

---

## Plan model

| Plan | Documents | Prompts/month | OCR |
|---|---|---|---|
| Free (no account) | 1 | 5 | No |
| Registered (free account) | 5 | 20 | No |
| Premium | Unlimited | 100 | Yes |

- Monthly counters reset on the 1st of each month
- Anonymous users are tracked via `x-anon-id` header (UUID stored in localStorage)
- The legal knowledge base is always available to all plans — it's the product's core value, not a paywall

---

## Project structure

```
nexus-docs-ai/
├── apps/
│   ├── server/                    # Express API — port 3001
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # Clerk + resolveIdentity + requireAuth
│   │   │   ├── routes/
│   │   │   │   ├── ingest.ts      # POST /api/ingest/document|legal
│   │   │   │   ├── query.ts       # POST /api/query (RAG + history + usage tracking)
│   │   │   │   ├── documents.ts   # GET|DELETE /api/documents
│   │   │   │   └── user.ts        # GET /api/user/me (plan + usage stats)
│   │   │   └── lib/
│   │   │       ├── claude.ts      # generateAnswer() with legal system prompt
│   │   │       ├── embeddings.ts  # chunkText() + embedText() via Voyage AI
│   │   │       ├── prisma.ts      # PrismaClient singleton
│   │   │       ├── storage.ts     # S3 upload/download/delete
│   │   │       ├── setupStorage.ts# Creates bucket on startup (skipped if no endpoint)
│   │   │       └── limits.ts      # PLAN_LIMITS per tier
│   │   └── prisma/
│   │       └── schema.prisma      # User, Document, DocumentChunk,
│   │                              # Conversation, Message, AnonUsage, QueryCache
│   └── web/                       # Next.js — port 3000
│       └── src/
│           ├── app/
│           │   ├── page.tsx           # Landing (redirect if authenticated)
│           │   ├── dashboard/         # Chat + upload
│           │   ├── pricing/           # Plans page
│           │   ├── sign-in/           # Clerk
│           │   └── sign-up/           # Clerk
│           ├── components/
│           │   ├── ChatBox.tsx            # Chat with history + conversationId
│           │   ├── DocumentUpload.tsx
│           │   ├── UserButtonWithUsage.tsx # Clerk UserButton with custom Usage tab
│           │   ├── UsagePanel.tsx          # Monthly usage bars (prompts + documents)
│           │   ├── UserPlan.tsx            # Plan badge + upgrade CTA
│           │   ├── Ticker.tsx             # Scrolling social proof strip
│           │   └── Accordion.tsx
│           ├── lib/
│           │   ├── t.ts           # i18n helper
│           │   └── anonId.ts      # UUID persisted in localStorage
│           ├── locales/es.json    # All UI strings in Spanish
│           └── middleware.ts      # Clerk route protection
├── scripts/
│   └── ingest-legal.ts            # Loads /legal-docs PDFs into pgvector
├── legal-docs/                    # Colombian legal PDFs
├── docker-compose.yml             # postgres+pgvector, minio, n8n (local dev only)
└── docker/postgres/init.sql       # vector extension init
```

---

## Database schema

```
User ──< Document ──< DocumentChunk (embedding vector(512))
  │
  └──< Conversation ──< Message (role: USER | ASSISTANT)

AnonUsage  (monthly prompt tracking for anonymous users)
QueryCache (semantic cache for pure legal queries)
```

- `Document.isPublicKnowledge = true` → pre-loaded legal docs, visible to all users
- `Document.userId / anonId` → personal docs, visible only to their owner
- `User.promptsThisMonth / promptsResetAt` → monthly usage counter with auto-reset
- Plan limits are enforced in middleware before each query

---

## Local setup

### 1. Requirements

- Node.js 20 LTS
- pnpm (`npm i -g pnpm`)
- Docker Desktop (for PostgreSQL, MinIO, and n8n)
- API keys: [Clerk](https://clerk.com), [Voyage AI](https://www.voyageai.com), [Anthropic](https://console.anthropic.com)

---

### 2. Environment variables

**`.env`** (monorepo root — read by `docker-compose.yml`)

```env
POSTGRES_USER=nexus
POSTGRES_PASSWORD=nexus_pass
POSTGRES_DB=nexusdocs

MINIO_ROOT_USER=nexus_admin
MINIO_ROOT_PASSWORD=nexus_minio_pass

N8N_ENCRYPTION_KEY=<random-32-char-string>
```

**`apps/server/.env`**

```env
DATABASE_URL=postgresql://nexus:nexus_pass@localhost:5433/nexusdocs
PORT=3001
WEB_URL=http://localhost:3000

CLERK_SECRET_KEY=sk_test_...
VOYAGE_API_KEY=pa-...
ANTHROPIC_API_KEY=sk-ant-...

MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=nexus_admin
MINIO_ROOT_PASSWORD=nexus_minio_pass
```

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

### 3. Start infrastructure

```bash
docker compose up -d
```

| Service | Local URL |
|---|---|
| PostgreSQL 16 + pgvector | `localhost:5433` |
| MinIO | `localhost:9000` (API) / `localhost:9001` (console) |
| n8n | `localhost:5678` |

---

### 4. Install dependencies

```bash
pnpm install
```

---

### 5. Run database migrations

```bash
cd apps/server
pnpm prisma migrate deploy
pnpm prisma generate
```

---

### 6. Load the legal knowledge base

```bash
cd apps/server
pnpm run ingest-legal
```

This reads the PDFs in `/legal-docs`, embeds them with Voyage AI, and inserts them into PostgreSQL with `isPublicKnowledge = true`.

---

### 7. Run in development

```bash
# From root — starts server and web in parallel
pnpm dev
```

| App | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| MinIO console | http://localhost:9001 |

---

## Production deployment

| Service | Provider |
|---|---|
| Frontend (Next.js) | Vercel |
| Backend (Express) | Render |
| Database (PostgreSQL + pgvector) | Neon |
| File storage | Cloudflare R2 |

---

## API endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/ingest/document` | anon/user | Upload and embed a personal PDF |
| `POST` | `/api/ingest/legal` | INTERNAL_SECRET | Load a legal document (script only) |
| `POST` | `/api/query` | anon/user | RAG query with conversation history |
| `GET` | `/api/documents` | user | List user's documents |
| `GET` | `/api/documents/:id/download` | user | Signed download URL |
| `DELETE` | `/api/documents/:id` | user | Delete document + chunks |
| `GET` | `/api/user/me` | user | Plan info + monthly usage stats |
