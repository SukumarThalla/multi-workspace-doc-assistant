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

// Streamed ingestion pipeline: extract -> hash (idempotency check) -> chunk -> embed each
// chunk one at a time, yielding progress after each so the client can show a percentage.
export async function* ingestDocumentStream(workspaceId, file) {
  const text = await extractText(file);
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  const existing = await findDocumentByHash(workspaceId, contentHash);
  if (existing) {
    yield { type: 'done', document: { ...existing, deduped: true } };
    return;
  }

  const document = await createDocument(workspaceId, file.originalname, contentHash);
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    await insertChunk(workspaceId, document.id, chunks[i], embedding, i);
    yield {
      type: 'progress',
      processed: i + 1,
      total: chunks.length,
      percent: Math.round(((i + 1) / chunks.length) * 100),
    };
  }

  yield { type: 'done', document: { ...document, chunkCount: chunks.length } };
}

// Chunks reference documents without ON DELETE CASCADE, so they're removed explicitly first.
export async function deleteDocument(workspaceId, documentId) {
  await pool.query('delete from chunks where workspace_id = $1 and document_id = $2', [workspaceId, documentId]);
  const { rows } = await pool.query(
    'delete from documents where workspace_id = $1 and id = $2 returning id',
    [workspaceId, documentId]
  );
  return rows[0] || null;
}

// The original uploaded file isn't stored anywhere — only its chunked text is. "Viewing" a
// document reassembles that text in order, which is what was actually indexed and searched.
// Visible if this workspace owns the document OR it's been explicitly shared in — matches
// the same rule retrieval uses, so "View" works for a shared-in document too.
export async function getDocumentContent(workspaceId, documentId) {
  const { rows: docRows } = await pool.query(
    `select filename from documents
     where id = $2
       and (workspace_id = $1
            or id in (select document_id from document_shares where shared_with_workspace_id = $1))`,
    [workspaceId, documentId]
  );
  if (!docRows[0]) return null;

  const { rows: chunkRows } = await pool.query(
    'select content from chunks where document_id = $1 order by chunk_index',
    [documentId]
  );
  return { filename: docRows[0].filename, content: chunkRows.map((c) => c.content).join('\n\n') };
}

// Opt-in cross-workspace sharing — see document_shares in schema.sql. Only a document that
// actually belongs to `workspaceId` can be shared from it, so a workspace can't grant access
// to something it doesn't own.
export async function shareDocument(workspaceId, documentId, targetWorkspaceId) {
  const owned = await pool.query('select id from documents where id = $1 and workspace_id = $2', [
    documentId,
    workspaceId,
  ]);
  if (!owned.rows[0]) return null;

  await pool.query(
    'insert into document_shares (document_id, shared_with_workspace_id) values ($1, $2) on conflict do nothing',
    [documentId, targetWorkspaceId]
  );
  return { documentId, targetWorkspaceId };
}

export async function unshareDocument(documentId, targetWorkspaceId) {
  await pool.query('delete from document_shares where document_id = $1 and shared_with_workspace_id = $2', [
    documentId,
    targetWorkspaceId,
  ]);
}

export async function listDocumentShares(documentId) {
  const { rows } = await pool.query(
    `select w.id as workspace_id, w.name
     from document_shares ds
     join workspaces w on w.id = ds.shared_with_workspace_id
     where ds.document_id = $1
     order by w.name`,
    [documentId]
  );
  return rows;
}

// Documents shared INTO this workspace from elsewhere — shown separately from the
// workspace's own uploads so it's always clear a document isn't natively yours.
export async function listSharedInDocuments(workspaceId) {
  const { rows } = await pool.query(
    `select d.id, d.filename, w.id as owner_workspace_id, w.name as owner_workspace_name,
            count(c.id)::int as chunk_count
     from document_shares ds
     join documents d on d.id = ds.document_id
     join workspaces w on w.id = d.workspace_id
     left join chunks c on c.document_id = d.id
     where ds.shared_with_workspace_id = $1
     group by d.id, w.id
     order by d.created_at`,
    [workspaceId]
  );
  return rows;
}
