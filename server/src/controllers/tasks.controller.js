import * as workspacesService from '../services/workspaces.service.js';
import * as tasksService from '../services/tasks.service.js';

export async function listTasks(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const rows = await tasksService.listTasks(req.params.workspaceId);
  res.json(rows);
}
