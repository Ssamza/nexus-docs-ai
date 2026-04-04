# NexusDocs AI

Full-stack RAG platform that transforms a Notion workspace into an AI-searchable knowledge base.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript 5 |
| Backend | Node.js, Express 5, TypeScript 5, ts-node/nodemon |
| ORM | Prisma 7 (custom output: `src/generated/prisma`) |
| DB | PostgreSQL (pgvector planned) |
| AI | LangChain / OpenAI — RAG architecture (planned) |

## Project structure

```
nexus-docs-ai/
├── apps/
│   ├── server/          # Express API (port 3001)
│   │   ├── src/
│   │   │   └── index.ts       # Entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma  # DB schema (empty, no models yet)
│   │   ├── prisma.config.ts
│   │   └── tsconfig.json
│   └── web/             # Next.js frontend (App Router)
│       └── src/
│           ├── app/
│           ├── globals.css
│           ├── layout.tsx
│           └── page.tsx
├── package.json         # Root — workspace scripts
└── pnpm-workspace.yaml
```

## Conventions

- App Router only (`src/app/`), no Pages Router
- React Compiler enabled (`reactCompiler: true` in `next.config.ts`)
- Prisma client output goes to `apps/server/src/generated/prisma` (non-standard path)
- Server runs on port 3001; Next.js default port 3000

## Commands

```bash
pnpm dev          # Run all apps in parallel (root)
pnpm build        # Build all apps

# Per-app
cd apps/server && pnpm dev    # nodemon + ts-node
cd apps/web    && pnpm dev    # next dev
```

## Key details

- Project is early-stage boilerplate — Prisma schema has no models yet, AI/RAG layer is not implemented
- Notion OAuth integration and pgvector are planned but not yet present in code
- `apps/server` has an untracked `.gitignore`, `prisma.config.ts`, and `prisma/` directory (git-untracked, likely env-sensitive)
