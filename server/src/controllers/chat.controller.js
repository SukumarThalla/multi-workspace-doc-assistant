import * as workspacesService from '../services/workspaces.service.js';
import * as chatService from '../services/chat.service.js';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../services/llm.service.js';

export async function listMessages(req, res) {
  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const messages = await chatService.listMessages(req.params.workspaceId);
  res.json(messages);
}

export async function postMessage(req, res) {
  const { message, model } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  // Never let client input reach the Gemini URL unchecked — only an allowlisted model name.
  const selectedModel = AVAILABLE_MODELS.includes(model) ? model : DEFAULT_MODEL;

  const workspace = await workspacesService.findWorkspaceForUser(req.params.workspaceId, req.userId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  // Server-sent events: the client renders each token as it arrives instead of
  // waiting for the full answer, and sees tool calls fire in real time.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // If the client cancels (abort the fetch), stop pulling more tokens/tool calls from
  // Gemini instead of finishing the work for a response nobody will see.
  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  try {
    for await (const event of chatService.sendMessageStream(req.params.workspaceId, message, selectedModel)) {
      if (clientGone) break;
      send(event);
    }
  } catch (err) {
    if (!clientGone) {
      console.error('Chat pipeline failed:', err);
      send({ type: 'error', message: 'The assistant failed to respond. Your message was saved — please retry.' });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}
