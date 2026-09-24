import { z } from 'zod';
import { pool } from '../../config/db.js';

const schema = z.object({
  title: z.string().min(1),
  dueDate: z.string().optional(),
});

const declaration = {
  name: 'save_task',
  description: 'Save a task/todo item to the current workspace',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      dueDate: { type: 'string' },
    },
    required: ['title'],
  },
};

async function execute(workspaceId, rawArgs) {
  const args = schema.parse(rawArgs);
  const { rows } = await pool.query(
    'insert into tasks (workspace_id, title, due_date) values ($1, $2, $3) returning id, title, due_date',
    [workspaceId, args.title, args.dueDate || null]
  );
  return rows[0];
}

export default { name: 'save_task', schema, declaration, execute };
