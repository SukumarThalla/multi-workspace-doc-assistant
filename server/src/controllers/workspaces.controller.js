import * as workspacesService from '../services/workspaces.service.js';

export async function listWorkspaces(req, res) {
  const workspaces = await workspacesService.listWorkspacesForUser(req.userId);
  res.json(workspaces);
}

export async function createWorkspace(req, res) {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const workspace = await workspacesService.createWorkspace(req.userId, name);
  res.status(201).json(workspace);
}

export async function getWorkspace(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.id, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  res.json(workspace);
}
