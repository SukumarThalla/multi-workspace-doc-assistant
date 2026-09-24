import { z } from 'zod';

const schema = z.object({
  summary: z.string().min(1),
});

const declaration = {
  name: 'send_summary_to_discord',
  description: 'Send a short summary message to the team Discord channel',
  parameters: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
    },
    required: ['summary'],
  },
};

async function execute(_workspaceId, rawArgs) {
  const args = schema.parse(rawArgs);

  const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: args.summary }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed (${res.status})`);
  }

  return { sent: true };
}

export default { name: 'send_summary_to_discord', schema, declaration, execute };
