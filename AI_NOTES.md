# AI Notes

## Which AI tools/models, and the split

Built with Claude Code (Claude Sonnet 5). The AI scaffolded the full project structure end-to-end in
one pass: `server/` (Express, ES modules, Supabase auth middleware, ingestion/chat/tools routes,
Gemini embedding + chat services, the pgvector schema) and `client/` (Vite + React, Supabase auth,
workspace switcher, chat UI, tool-call log). No manual coding has happened yet beyond this scaffold —
the next phase is provisioning the real Supabase/Gemini/Discord accounts, running the schema, and
testing end-to-end.

## 2–3 key decisions

- **Single shared `chunks` table with a `workspace_id` column and a query-time filter** (never a
  per-workspace table), per the assignment's explicit "don't sidestep this" constraint. The filter is
  baked into `retrieveChunks()` (`server/src/services/retrieval.js`) so there's exactly one code path
  that can leak data, and it's the one place to audit.
- **ES modules over CommonJS** for the backend, to match the frontend's module style and avoid mixing
  `require`/`import` across the codebase.
- **Idempotent ingestion via a `(workspace_id, content_hash)` unique constraint** rather than an
  application-level "check then insert" — lets Postgres itself guarantee no duplicate chunks even under
  concurrent re-uploads/retries.

## Hardest bug / wrong turn

_TODO — fill in after real end-to-end testing against live Supabase/Gemini. Nothing has been run
against real credentials yet, so there's no genuine bug to report honestly._

## What I'd improve with more time

_TODO — fill in once the stretch goals (retrieval-debug view, hybrid search, streaming, multi-step
tool use) have been attempted._
