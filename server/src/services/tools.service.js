import { pool } from '../config/db.js';

// Reads the tool_calls audit log for a workspace. Not to be confused with
// services/toolHandlers/, which holds the pluggable tool implementations themselves.
export async function listToolCalls(workspaceId) {
  const { rows } = await pool.query(
    'select id, tool_name, arguments, result, status, created_at from tool_calls where workspace_id = $1 order by created_at desc',
    [workspaceId]
  );
  return rows;
}
