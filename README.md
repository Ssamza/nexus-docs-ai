# 🚀 NexusDocs AI

**NexusDocs AI** is a professional-grade RAG (Retrieval-Augmented Generation) platform that transforms your **Notion** workspace into an intelligent, searchable knowledge base. Chat with your documents, extract insights, and bridge the gap between static notes and AI-driven intelligence.

---

## 🏗️ Architecture & Tech Stack

This project is built as a **TypeScript Monorepo** using `pnpm workspaces` for seamless integration between the frontend and backend.

### Frontend (`apps/web`)

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Performance:** React Compiler enabled 🚀

### Backend (`apps/server`)

- **Framework:** Node.js + Express
- **Database:** PostgreSQL
- **ORM:** Prisma
- **AI Engine:** LangChain / OpenAI (RAG Architecture)

---

## 🌟 Key Features

- **Seamless Notion Integration:** Connect your Notion pages via OAuth 2.0.
- **RAG Implementation:** Context-aware AI responses based on your actual documents.
- **Vector Search:** High-performance document retrieval using `pgvector` in PostgreSQL.
- **Modern UI:** Clean, responsive dashboard with dark mode support.
- **Secure by Design:** Follows OWASP security principles for data handling.

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (Latest LTS)
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USER/nexus-docs-ai.git](https://github.com/YOUR_USER/nexus-docs-ai.git)
   cd nexus-docs-ai
   ```
