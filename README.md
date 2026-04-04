# NexusDocs AI

Asistente RAG especializado en **derecho laboral, tributario y seguridad social colombiana**. Combina una base legal pre-cargada (CST, Estatuto Tributario, Ley 2381, etc.) con documentos personales del usuario (contratos, colillas de pago) para responder preguntas en lenguaje natural.

---

## Stack

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Next.js (App Router), React 19, Tailwind CSS v4, TypeScript |
| Backend | Express 5, TypeScript, ts-node/nodemon |
| Auth | Clerk (JWT + anonymous sessions) |
| ORM | Prisma 7 — output: `apps/server/src/generated/prisma` |
| Base de datos | PostgreSQL 16 + pgvector |
| Embeddings | Voyage AI (`voyage-3-lite`, 512 dims) |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) |
| Storage | MinIO (S3-compatible, archivos originales) |
| Infraestructura | Docker Compose (postgres, minio, n8n) |

---

## Arquitectura

```
Usuario
  │
  ├─ Sube PDF personal ──────────────────────────────────────────┐
  │                                                               │
  └─ Hace una pregunta                                            │
       │                                                          │
       ▼                                                          ▼
  [ Next.js ]                                             [ Express API ]
  apps/web                                                apps/server
       │                                                          │
       │  POST /api/query                          POST /api/ingest/document
       │  POST /api/ingest/document                      │
       │──────────────────────────────────────────►       │
                                                          ▼
                                                   pdf-parse (extrae texto)
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

### Flujo de consulta

```
Usuario escribe pregunta
        │
        ▼
Voyage AI embed(query) → vector 512d
        │
        ▼
pgvector similarity search
  WHERE isPublicKnowledge = true   ← leyes pre-cargadas
     OR userId/anonId = current    ← docs personales
  ORDER BY embedding <=> query_vec
  LIMIT 6
        │
        ▼
Claude claude-sonnet-4-6
  system: prompt legal colombiano
  context: top-6 chunks relevantes
  history: últimos 20 mensajes del hilo
        │
        ▼
Respuesta + conversationId guardados en DB
```

### Base legal pre-cargada (`/legal-docs`)

| Archivo | Norma |
|---|---|
| Código Sustantivo del Trabajo | CST (base laboral) |
| Decreto 1072 de 2015 | Decreto Único Reglamentario |
| Ley 50 de 1990 | Reforma laboral |
| Ley 789 de 2002 | Reforma laboral / SENA |
| Ley 1010 de 2006 | Acoso laboral |
| Ley 2101 de 2021 | Reducción jornada (40h) |
| Ley 100 de 1993 | Seguridad social (salud) |
| Ley 2381 de 2024 | Reforma pensional (sistema de pilares) |
| Estatuto Tributario | Base tributaria compilada |
| Ley 2277 de 2022 | Reforma tributaria |
| Resolución 44 DIAN 2024 | Formulario 210 — renta personas naturales |
| ABC Declaración Renta 2022 | Guía práctica DIAN |
| Concepto Retención en la Fuente | DIAN |

---

## Modelo de planes

| Plan | Documentos | Preguntas/día | OCR |
|---|---|---|---|
| Anónimo (sin cuenta) | 1 por sesión | 5 | No |
| Registrado (cuenta gratis) | 5 | 20 | No |
| Premium ($2–3/mes) | Ilimitado | Ilimitado | Sí |

La base legal siempre está disponible para todos los planes — es el diferencial del producto, no el paywall.

---

## Estructura del proyecto

```
nexus-docs-ai/
├── apps/
│   ├── server/                    # Express API — puerto 3001
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # Clerk + resolveIdentity + requireAuth
│   │   │   ├── routes/
│   │   │   │   ├── ingest.ts      # POST /api/ingest/document|legal
│   │   │   │   ├── query.ts       # POST /api/query (RAG + historial)
│   │   │   │   └── documents.ts   # GET|DELETE /api/documents
│   │   │   └── lib/
│   │   │       ├── claude.ts      # generateAnswer() con system prompt legal
│   │   │       ├── embeddings.ts  # chunkText() + embedText() via Voyage AI
│   │   │       ├── prisma.ts      # PrismaClient singleton
│   │   │       ├── storage.ts     # MinIO upload/download/delete
│   │   │       ├── setupStorage.ts# Crea el bucket al iniciar
│   │   │       └── limits.ts      # PLAN_LIMITS por tier
│   │   └── prisma/
│   │       └── schema.prisma      # User, Document, DocumentChunk,
│   │                              # Conversation, Message
│   └── web/                       # Next.js — puerto 3000
│       └── src/
│           ├── app/
│           │   ├── page.tsx       # Landing (redirect si auth)
│           │   ├── dashboard/     # Chat + upload
│           │   ├── sign-in/       # Clerk
│           │   └── sign-up/       # Clerk
│           ├── components/
│           │   ├── ChatBox.tsx    # Chat con historial + conversationId
│           │   └── DocumentUpload.tsx
│           ├── lib/
│           │   ├── t.ts           # i18n helper
│           │   └── anonId.ts      # UUID persistido en localStorage
│           ├── locales/es.json    # Textos en español
│           └── middleware.ts      # Clerk route protection
├── scripts/
│   └── ingest-legal.ts            # Carga los PDFs de /legal-docs a pgvector
├── legal-docs/                    # PDFs de la base legal colombiana
├── n8n/workflows/                 # Workflow de sincronización Notion
├── docker-compose.yml             # postgres+pgvector, minio, n8n
└── docker/postgres/init.sql       # Extensión vector
```

---

## Schema de base de datos

```
User ──< Document ──< DocumentChunk (embedding vector(512))
  │
  └──< Conversation ──< Message (role: USER | ASSISTANT)
```

- `Document.isPublicKnowledge = true` → documentos legales pre-cargados, visibles para todos
- `Document.userId / anonId` → documentos personales, visibles solo para su dueño
- Los límites de plan se aplican en middleware antes de cada operación

---

## Setup local

### 1. Requisitos

- Node.js LTS, pnpm
- Docker Desktop

### 2. Variables de entorno

**`apps/server/.env`**
```env
DATABASE_URL=postgresql://user:pass@localhost:5433/nexusdocs
PORT=3001
WEB_URL=http://localhost:3000

CLERK_SECRET_KEY=sk_test_...
VOYAGE_API_KEY=pa-...
ANTHROPIC_API_KEY=sk-ant-...
INTERNAL_SECRET=un-secret-seguro-aqui

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

### 3. Levantar infraestructura

```bash
docker compose up -d
```

### 4. Instalar dependencias y migrar

```bash
pnpm install
cd apps/server && npx prisma migrate deploy
```

### 5. Cargar base legal

Requiere método de pago en [dashboard.voyageai.com](https://dashboard.voyageai.com/) para desbloquear rate limits (los primeros 200M tokens son gratis).

```bash
cd apps/server
pnpm run ingest-legal
```

### 6. Correr en desarrollo

```bash
# Desde la raíz (ambas apps en paralelo)
pnpm dev

# O por separado
cd apps/server && pnpm dev   # Express en :3001
cd apps/web    && pnpm dev   # Next.js en :3000
```

---

## API endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/ingest/document` | anon/user | Sube y embede un PDF personal |
| `POST` | `/api/ingest/legal` | INTERNAL_SECRET | Carga un documento legal (script/n8n) |
| `POST` | `/api/query` | anon/user | RAG query con historial de conversación |
| `GET` | `/api/documents` | user | Lista documentos del usuario |
| `GET` | `/api/documents/:id/download` | user | URL firmada de descarga (MinIO) |
| `DELETE` | `/api/documents/:id` | user | Elimina documento + chunks |
