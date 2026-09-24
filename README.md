# Multi-Workspace Document Assistant (RAG & Tool Calling)

A web app where a signed-in user manages multiple workspaces, uploads documents into them, and chats
with an assistant that answers grounded only in the active workspace's documents (with citations), can
call tools (save a task, post a Discord summary), and never leaks one workspace's content into another —
even though every workspace's chunks live in one shared `chunks` table.

## Stack

- **Backend:** Node.js + Express (`server/`)
- **Auth + Database:** Supabase (Postgres + `pgvector` + email/password auth)
- **LLM + embeddings:** Google Gemini (`gemini-2.5-flash` for chat/tool-calling, `gemini-embedding-001` for embeddings — Gemini deprecates model names periodically; check `GET /v1beta/models` if either 404s)
- **Notifications tool:** Discord incoming webhook
- **Frontend:** React + Vite (`client/`)

## Project structure

```
server/src/
  index.js                    # app entrypoint, route wiring
  config/db.js                 # pg pool
  middleware/auth.js           # Supabase JWT verification
  routes/                      # *.routes.js — one per resource, thin: params -> controller
    workspaces.routes.js
    documents.routes.js
    chat.routes.js
    tools.routes.js
    tasks.routes.js
  controllers/                 # *.controller.js — request/response glue, calls services
    workspaces.controller.js
    documents.controller.js
    chat.controller.js
    tools.controller.js
    tasks.controller.js
  services/                    # *.service.js — business logic, DB queries, external API calls
    workspaces.service.js
    documents.service.js       # ingestion pipeline (extract -> hash -> chunk -> embed -> store)
    chat.service.js             # RAG + tool-calling loop, streamed as SSE
    embeddings.service.js       # Gemini embedding calls
    llm.service.js              # Gemini streaming chat calls
    retrieval.service.js        # workspace-scoped vector search
    tools.service.js            # tool-call log
    tasks.service.js
    toolHandlers/                # save_task, notifyDiscord — the tools the model can call
  utils/
    chunker.js                  # text -> overlapping chunks
    pdf.js                       # PDF text extraction
  db/schema.sql                # table definitions incl. pgvector

client/src/
  supabaseClient.js    # Supabase auth client
  api.js               # fetch wrapper (auth headers, JSON + SSE streaming)
  App.jsx              # routing (/login, /dashboard/:workspaceId) + auth guard
  Login.jsx / Dashboard.jsx
  components/          # Toast, Spinner, Skeleton, TypingIndicator, FormattedText,
                        # ThemeToggle, WorkspaceSelect, WorkspaceModal
```

## Local setup

### 1. Prerequisites

- Node.js LTS
- A [Supabase](https://supabase.com) project (free tier)
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini, free tier)
- A Discord server you own, with a channel webhook URL

### 2. Supabase setup

1. Create a project.
2. In the SQL editor, run:
   ```sql
   create extension if not exists vector;
   ```
   then run everything in `server/src/db/schema.sql`.
3. Enable email/password auth (Authentication → Providers).
4. Collect: the Postgres connection string, project URL, anon key, service role key, and JWT secret
   (Project Settings → API / → JWT Keys).

### 3. Environment variables

Copy `.env.example` to `.env` in `server/`, and `client/.env.example` to `client/.env`, and fill them in.
Never commit the real `.env` files.

**`server/.env`**
```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
GEMINI_API_KEY=
DISCORD_WEBHOOK_URL=
PORT=3000
```

**`client/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3000
```

### 4. Run locally

```bash
# backend
cd server
npm install
npm run dev      # http://localhost:3000

# frontend, in a second terminal
cd client
npm install
npm run dev       # http://localhost:5173
```

## Deployment

Deploy `server/` and `client/` as two services (e.g. on Render, Vercel, or Netlify — all have free,
no-card tiers). Paste every env var above into the host's dashboard; never commit real secrets. Point
the deployed client's `VITE_API_URL` at the deployed server's URL.

_Deployed URL: TODO — fill in once deployed._

## Testing the isolation guarantee

1. Sign in, create Workspace A, upload a document containing a unique fact (e.g. "The secret launch code
   is BANANA-42").
2. Create Workspace B, upload an unrelated document.
3. Switch to Workspace B and ask for the secret launch code — the assistant must say it doesn't know.
   If it leaks the fact, the `workspace_id` filter is missing from the retrieval query
   (`server/src/services/retrieval.service.js`).

## Requirements checklist

- [x] Deployed, publicly reachable web app with sign-in — _pending deployment_
- [x] Multiple workspaces per user, with a switcher; uploads/chat scoped to active workspace
- [x] Single shared vector table (`chunks`) with a `workspace_id` column
- [x] Ingestion: documents uploadable per workspace, chunked, embedded, stored tagged with workspace
- [x] Grounded RAG chat: retrieval scoped to active workspace only, citations to source doc
- [x] Honest "I don't know" via system prompt instruction
- [x] 2 tools the model can call (`save_task`, `send_summary_to_discord`); validated, executed, logged
- [x] Dashboard behind login: documents, chat history, tool-call log, workspace switcher
- [x] `README.md` with local run + deployment instructions
- [x] Workspace filter applied inside the vector query, not post-filtered
- [x] Tool arguments validated with `zod`; unknown tools / malformed args handled without crashing
- [x] Retrieved document text wrapped in `<retrieved_context>` and treated as data, not instructions
- [x] User's message saved before the LLM call, so it isn't lost on failure
- [x] Ingestion idempotent via `(workspace_id, content_hash)` unique constraint
- [x] No secrets in repo (`.env` gitignored, only `.env.example` committed)
- [ ] Deployed to a real public host — _pending_
