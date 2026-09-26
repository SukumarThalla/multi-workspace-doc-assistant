import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Never assume the error body is JSON — a proxy/crash/unhandled route can return
// plain text or HTML, and res.json() throws a confusing parse error in that case.
async function throwForStatus(res) {
  if (res.ok) return;
  let message = res.statusText;
  try {
    const data = await res.json();
    message = data.error || message;
  } catch {
    // response wasn't JSON — fall back to statusText
  }
  throw new Error(message);
}

export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: await authHeaders() });
  await throwForStatus(res);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await throwForStatus(res);
  return res.json();
}

// Reads a text/event-stream response body, calling onEvent(parsedJson) for each `data: ...` line.
async function readEventStream(res, onEvent) {
  if (!res.ok || !res.body) {
    await throwForStatus(res);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr) onEvent(JSON.parse(jsonStr));
    }
  }
}

// Pass { signal } (an AbortController's signal) to let the caller cancel mid-stream.
export async function apiPostStream(path, body, onEvent, { signal } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  await readEventStream(res, onEvent);
}

export async function apiUpload(path, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });
  await throwForStatus(res);
  return res.json();
}

// Same as apiUpload, but the server streams { type: 'progress', percent, ... } events while
// the document is being chunked/embedded, ending with a { type: 'done', document } event.
export async function apiUploadStream(path, file, onEvent) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });
  await readEventStream(res, onEvent);
}

export async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await throwForStatus(res);
  return res.json();
}
