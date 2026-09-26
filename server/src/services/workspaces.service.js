import { pool } from '../config/db.js';

export async function listWorkspacesForUser(userId) {
  const { rows } = await pool.query(
    'select id, name, created_at from workspaces where user_id = $1 order by created_at',
    [userId]
  );
  return rows;
}

// Default formatting for a new workspace's name — capitalize its first letter so the
// dashboard/dropdown look consistent regardless of how the user typed it in.
function capitalizeFirstLetter(name) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function createWorkspace(userId, name) {
  const { rows } = await pool.query(
    'insert into workspaces (user_id, name) values ($1, $2) returning id, name, created_at',
    [userId, capitalizeFirstLetter(name)]
  );
  return rows[0];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The ownership check every other service relies on: a workspace only exists,
// as far as any request is concerned, if it belongs to the requesting user.
// A malformed id (e.g. a stale/bad URL, or "null" from a client bug) is treated as
// "not found" instead of reaching Postgres, which would otherwise throw a raw
// "invalid input syntax for type uuid" error and crash the request with a 500.
export async function findWorkspaceForUser(id, userId) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;

  const { rows } = await pool.query(
    'select id, name, created_at from workspaces where id = $1 and user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}
