# AI Notes

## Which AI tools/models, and the split

Built with Claude Code (Claude Sonnet 5) as the primary implementer, end-to-end: initial scaffold
(`server/` — Express, ES modules, Supabase auth middleware, ingestion/chat/tools routes, Gemini
embedding + chat services, the pgvector schema — and `client/` — Vite + React, Supabase auth,
workspace switcher, chat UI, tool-call log), then every feature, bug fix, and UI pass after that.

The split: I drove product decisions and testing — what to build next, what a bug looked like from the
UI, which stretch goals to keep vs. cut, when something felt off (dark-mode contrast, tooltip missing,
retrieval citing the wrong document) — and reviewed/tested everything by using the live app myself
after each change. The AI wrote essentially all the code, proposed the technical approach for each
piece, and iterated based on my bug reports. I did not hand-write application code; I directed it and
verified the result against the deployed app.

## AI context files

`CLAUDE.md` (repo root) is the project conventions/instruction file used throughout development — it
captures the non-negotiable invariants (workspace-filter rules, tool validation, idempotent ingestion)
that guided every change. Committed as-is, per deliverable #5.

## 2–3 key decisions

- **Single shared `chunks` table with a `workspace_id` column and a query-time filter** (never a
  per-workspace table), per the assignment's explicit "don't sidestep this" constraint. The filter is
  baked into `retrieveChunks()` (`server/src/services/retrieval.service.js`) so there's exactly one
  code path that can leak data, and it's the one place to audit.
- **Hybrid search (vector + keyword) over vector-only**, added after a real grounding failure (see
  below): pure cosine-similarity search wasn't reliable for name/keyword-specific questions, so
  retrieval now merges vector results with a Postgres full-text (`to_tsvector`/`to_tsquery`) keyword
  search, deduped by chunk id — both queries still scoped by `workspace_id`.
- **Idempotent ingestion via a `(workspace_id, content_hash)` unique constraint** rather than an
  application-level "check then insert" — lets Postgres itself guarantee no duplicate chunks even under
  concurrent re-uploads/retries.

## Hardest bug / wrong turn

After uploading a resume plus a couple of unrelated PDFs into one workspace, I asked "explain about
[my name]" and the assistant said it didn't know — citing an unrelated JavaScript-questions PDF as its
source instead of the resume that actually contained the answer. Retrieval was vector-similarity-only
at that point: the question embedding was landing closer to a generically-phrased document than to the
resume, because plain vector search doesn't weight an exact name/keyword match strongly enough against
overall semantic similarity. The AI's first-pass retrieval design (embed-and-cosine-search, nothing
else) looked correct and passed the isolation tests, but it hadn't been stress-tested against a
realistic multi-document question — the assessment's own golden-path check ("ask a question, get a
grounded answer") caught what the isolation tests didn't.

I noticed it by actually using the app as a real user would, not just running the isolation test case.
The fix was hybrid search: keep the vector search, but OR it with a Postgres keyword search over the
same chunks, merge and dedupe the two result sets, still filtered by `workspace_id` in both queries.
That single change fixed the specific question and is also one of the assessment's stretch goals.

## What I'd improve with more time

I implemented a retrieval-debug view (workspace id + every chunk used, to visually prove isolation),
per-request observability (response time, token counts), and opt-in cross-workspace document sharing —
all as stretch goals — then pulled all three back out before submission to keep the surface area
smaller and more polished given the time left. With more time I'd re-add the retrieval-debug view
first, since it's the most direct way to demonstrate the isolation guarantee the assessment weighs most
heavily, followed by observability. I'd also add a re-ranking step on top of the current hybrid search,
and add automated tests around the workspace-isolation boundary instead of relying only on manual
testing.
