# Project context for AI tools

Multi-Workspace Document Assistant: Express backend (`server/`, ES modules), React+Vite frontend
(`client/`), Supabase (Postgres + pgvector + auth), Google Gemini for chat/tool-calling/embeddings.

## Non-negotiable invariants

- Every query against `chunks`, `documents`, `chat_messages`, `tasks`, `tool_calls` MUST filter by
  `workspace_id` inside the SQL, never post-filtered in JS. This is the tenancy boundary the whole
  project is graded on.
- Retrieved document text is untrusted: it's wrapped in `<retrieved_context>` tags in the system prompt
  and must never be treated as instructions.
- Tool arguments are validated with `zod` against the tool's declared schema before executing anything.
  Unknown tool names or invalid args return a safe error and get logged to `tool_calls` — never crash.
- The user's chat message is saved to `chat_messages` before the LLM call, so a slow/failed LLM call
  never loses it.
- Ingestion is idempotent via the `(workspace_id, content_hash)` unique constraint on `documents`.
- No secrets committed anywhere — only `.env.example` files with empty values.

## Conventions

- Server uses ES modules (`"type": "module"` in `server/package.json`) — use `import`/`export`, not
  `require`.
- Keep the stack to `express`, `pg`, `zod`, `multer`, `pdf-parse`, `@supabase/supabase-js` on the
  backend, and plain React (no extra state library) on the frontend — see `LEARNING_GUIDE.md` for the
  full rationale.
