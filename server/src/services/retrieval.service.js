import { pool } from '../config/db.js';
import { embedText } from './embeddings.service.js';

const TOP_K = 5;

// Retrieves the top-K chunks for a question, scoped to a single workspace.
// The workspace_id filter is part of the SQL query itself (not applied after the fact) —
// this is the isolation boundary the whole app depends on.
export async function retrieveChunks(workspaceId, question, topK = TOP_K) {
  const questionEmbedding = await embedText(question);

  const { rows } = await pool.query(
    `select c.content, c.chunk_index, d.id as document_id, d.filename,
            c.embedding <=> $1 as distance
     from chunks c
     join documents d on d.id = c.document_id
     where c.workspace_id = $2
     order by distance
     limit $3`,
    [JSON.stringify(questionEmbedding), workspaceId, topK]
  );

  return rows;
}
