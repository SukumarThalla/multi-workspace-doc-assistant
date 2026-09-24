import { pool } from '../config/db.js';

export async function listTasks(workspaceId) {
  const { rows } = await pool.query(
    'select id, title, due_date, created_at from tasks where workspace_id = $1 order by created_at desc',
    [workspaceId]
  );
  return rows;
}
