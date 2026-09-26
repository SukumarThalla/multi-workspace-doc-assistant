import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import workspacesRouter from './routes/workspaces.routes.js';
import documentsRouter from './routes/documents.routes.js';
import chatRouter from './routes/chat.routes.js';
import toolsRouter from './routes/tools.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './services/llm.service.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Supabase's confirmation/magic-link emails redirect to whatever "Site URL" is configured
// in the Supabase dashboard — if that still points at this API server (a common leftover
// default), the browser lands here instead of the frontend. The token itself is a URL
// *fragment* (`#access_token=...`), which browsers never send to the server, so there's
// nothing to read server-side — we can only forward the browser there, hash and all, via
// client-side JS, and let the frontend's Supabase client pick the session up from the URL.
app.get('/', (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
  </head>
  <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;background:#05070d;color:#f5f7fa;">
    <p>Confirming your email, redirecting…</p>
    <script>
      window.location.replace(${JSON.stringify(frontendUrl)} + '/login' + window.location.hash);
    </script>
  </body>
</html>`);
});

// Single source of truth for the client's model picker — keeps it from drifting
// out of sync with the allowlist chat.controller.js actually accepts.
app.get('/models', (_req, res) => {
  res.json({ models: AVAILABLE_MODELS, default: DEFAULT_MODEL });
});

app.use('/workspaces', requireAuth, workspacesRouter);
app.use('/workspaces/:workspaceId/documents', requireAuth, documentsRouter);
app.use('/workspaces/:workspaceId/chat', requireAuth, chatRouter);
app.use('/workspaces/:workspaceId/tool-calls', requireAuth, toolsRouter);
app.use('/workspaces/:workspaceId/tasks', requireAuth, tasksRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Catches every error thrown/rejected in a route (Express 5 forwards async
// rejections here automatically) and guarantees JSON, never Express's HTML
// default error page — the frontend only ever needs to handle JSON.
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
