import { pool } from '../config/db.js';
import { embedText } from './embeddings.service.js';

const TOP_K = 5;
const KEYWORD_K = 5;
const MAX_RESULTS = 8;
// Cosine distance cutoff (0 = identical, 2 = opposite direction). Vector-only chunks past
// this are treated as "not actually relevant" — without it, a greeting like "hi" would still
// pull back 5 unrelated chunks and attach their filenames as citations to a small-talk reply.
// Keyword-matched chunks are exempt: they're included because the text itself matched, not
// because of a (possibly misleading) embedding distance.
const MAX_DISTANCE = 0.8;

// Turns free text into an OR-joined tsquery ("explain | about | sukumar | thalla") instead of
// the default AND behavior — we want chunks mentioning ANY significant word from the question
// (especially proper nouns a vector search can rank low), ranked by how many/how rare the
// matched terms are via ts_rank, not chunks that happen to contain every word.
function buildOrTsQuery(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return null;
  return words.join(' | ');
}

async function vectorSearch(workspaceId, questionEmbedding, topK) {
  const { rows } = await pool.query(
    `select c.id as chunk_id, c.content, c.chunk_index, d.id as document_id, d.filename,
            c.embedding <=> $1 as distance
     from chunks c
     join documents d on d.id = c.document_id
     where c.workspace_id = $2
     order by distance
     limit $3`,
    [JSON.stringify(questionEmbedding), workspaceId, topK]
  );
  return rows
    .filter((r) => r.distance <= MAX_DISTANCE)
    .map((r) => ({ ...r, source: 'vector', score: r.distance }));
}

async function keywordSearch(workspaceId, tsQuery, limit) {
  if (!tsQuery) return [];
  const { rows } = await pool.query(
    `select c.id as chunk_id, c.content, c.chunk_index, d.id as document_id, d.filename,
            ts_rank(to_tsvector('english', c.content), to_tsquery('english', $2)) as rank
     from chunks c
     join documents d on d.id = c.document_id
     where c.workspace_id = $1
       and to_tsvector('english', c.content) @@ to_tsquery('english', $2)
     order by rank desc
     limit $3`,
    [workspaceId, tsQuery, limit]
  );
  return rows.map((r) => ({ ...r, source: 'keyword', score: r.rank }));
}

// Hybrid retrieval: vector similarity finds semantically related chunks; Postgres full-text
// keyword search catches exact terms — like a person's name — that embedding similarity can
// rank below unrelated content even when the keyword match is obviously the right source.
// Both queries filter by workspace_id themselves (not applied after the fact), so isolation
// holds regardless of which path a chunk was found through.
export async function retrieveChunks(workspaceId, question, topK = TOP_K) {
  const questionEmbedding = await embedText(question);
  const tsQuery = buildOrTsQuery(question);

  const [vectorRows, keywordRows] = await Promise.all([
    vectorSearch(workspaceId, questionEmbedding, topK),
    keywordSearch(workspaceId, tsQuery, KEYWORD_K),
  ]);

  const seen = new Set();
  const merged = [];
  for (const row of [...vectorRows, ...keywordRows]) {
    if (seen.has(row.chunk_id)) continue;
    seen.add(row.chunk_id);
    merged.push(row);
  }
  return merged.slice(0, MAX_RESULTS);
}
