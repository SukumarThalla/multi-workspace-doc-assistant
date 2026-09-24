import { pool } from '../config/db.js';

export async function listWorkspacesForUser(userId) {
  const { rows } = await pool.query(
    'select id, name, created_at from workspaces where user_id = $1 order by created_at',
    [userId]
  );
  return rows;
}

export async function createWorkspace(userId, name) {
  const { rows } = await pool.query(
    'insert into workspaces (user_id, name) values ($1, $2) returning id, name, created_at',
    [userId, name]
  );
  return rows[0];
}

// The ownership check every other service relies on: a workspace only exists,
// as far as any request is concerned, if it belongs to the requesting user.
export async function findWorkspaceForUser(id, userId) {
  const { rows } = await pool.query(
    'select id, name, created_at from workspaces where id = $1 and user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}
