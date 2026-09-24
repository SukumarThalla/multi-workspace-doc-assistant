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

  const result = await documentsService.ingestDocument(req.params.workspaceId, req.file);
  res.status(result.deduped ? 200 : 201).json(result);
}
