import * as workspacesService from '../services/workspaces.service.js';
import * as documentsService from '../services/documents.service.js';

export async function listDocuments(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const documents = await documentsService.listDocuments(req.params.workspaceId);
  res.json(documents);
}

export async function uploadDocument(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  if (!req.file) return res.status(400).json({ error: 'file is required' });

  // Server-sent events: chunking + embedding a large document can take a while, so the
  // client shows a live percentage instead of a spinner frozen until the whole thing finishes.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  try {
    for await (const event of documentsService.ingestDocumentStream(req.params.workspaceId, req.file)) {
      if (clientGone) break;
      send(event);
    }
  } catch (err) {
    if (!clientGone) {
      console.error('Document ingestion failed:', err);
      send({ type: 'error', message: 'Failed to process the document. Please try again.' });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}

export async function deleteDocument(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const deleted = await documentsService.deleteDocument(req.params.workspaceId, req.params.documentId);
  if (!deleted) return res.status(404).json({ error: 'Document not found' });
  res.json({ id: deleted.id });
}

export async function getDocumentContent(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const doc = await documentsService.getDocumentContent(req.params.workspaceId, req.params.documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
}

export async function listSharedDocuments(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const docs = await documentsService.listSharedInDocuments(req.params.workspaceId);
  res.json(docs);
}

export async function listDocumentShares(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const shares = await documentsService.listDocumentShares(req.params.documentId);
  res.json(shares);
}

// Sharing only ever crosses workspaces within the same account — there's no multi-user
// collaboration model here, so both the source and target workspace must belong to req.userId.
export async function shareDocument(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const { targetWorkspaceId } = req.body;
  if (!targetWorkspaceId || typeof targetWorkspaceId !== 'string') {
    return res.status(400).json({ error: 'targetWorkspaceId is required' });
  }
  if (targetWorkspaceId === req.params.workspaceId) {
    return res.status(400).json({ error: 'A document is already visible in its own workspace' });
  }

  const targetWorkspace = await workspacesService.findWorkspaceForUser(targetWorkspaceId, req.userId);
  if (!targetWorkspace) return res.status(404).json({ error: 'Target workspace not found' });

  const result = await documentsService.shareDocument(req.params.workspaceId, req.params.documentId, targetWorkspaceId);
  if (!result) return res.status(404).json({ error: 'Document not found in this workspace' });
  res.status(201).json({ sharedWith: { id: targetWorkspace.id, name: targetWorkspace.name } });
}

export async function unshareDocument(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  await documentsService.unshareDocument(req.params.documentId, req.params.targetWorkspaceId);
  res.json({ ok: true });
}
