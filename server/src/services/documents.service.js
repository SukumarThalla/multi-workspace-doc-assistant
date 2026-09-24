import crypto from 'crypto';
import { pool } from '../config/db.js';
import { extractText } from '../utils/pdf.js';
import { chunkText } from '../utils/chunker.js';
import { embedText } from './embeddings.service.js';

export async function listDocuments(workspaceId) {
  const { rows } = await pool.query(
    `select d.id, d.filename, d.created_at, count(c.id)::int as chunk_count
     from documents d
     left join chunks c on c.document_id = d.id
     where d.workspace_id = $1
     group by d.id
     order by d.created_at`,
    [workspaceId]
  );
  return rows;
}

async function findDocumentByHash(workspaceId, contentHash) {
  const { rows } = await pool.query(
    'select id, filename, created_at from documents where workspace_id = $1 and content_hash = $2',
    [workspaceId, contentHash]
  );
  return rows[0] || null;
}

async function createDocument(workspaceId, filename, contentHash) {
  const { rows } = await pool.query(
    'insert into documents (workspace_id, filename, content_hash) values ($1, $2, $3) returning id, filename, created_at',
    [workspaceId, filename, contentHash]
  );
  return rows[0];
}

async function insertChunk(workspaceId, documentId, content, embedding, chunkIndex) {
  await pool.query(
    'insert into chunks (workspace_id, document_id, content, embedding, chunk_index) values ($1, $2, $3, $4, $5)',
    [workspaceId, documentId, content, JSON.stringify(embedding), chunkIndex]
  );
}

// Full ingestion pipeline: extract -> hash (idempotency check) -> chunk -> embed -> store.
export async function ingestDocument(workspaceId, file) {
  const text = await extractText(file);
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  const existing = await findDocumentByHash(workspaceId, contentHash);
  if (existing) return { ...existing, deduped: true };

  const document = await createDocument(workspaceId, file.originalname, contentHash);

  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    await insertChunk(workspaceId, document.id, chunks[i], embedding, i);
  }

  return { ...document, chunkCount: chunks.length };
}
