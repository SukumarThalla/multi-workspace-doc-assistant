import * as workspacesService from '../services/workspaces.service.js';
import * as toolsService from '../services/tools.service.js';

export async function listToolCalls(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const rows = await toolsService.listToolCalls(req.params.workspaceId);
  res.json(rows);
}
