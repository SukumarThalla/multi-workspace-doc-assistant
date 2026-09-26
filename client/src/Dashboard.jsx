import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { apiGet, apiPost, apiPostStream, apiUploadStream, apiDelete } from './api';
import { useToast } from './components/Toast';
import { PageLoader } from './components/Spinner';
import Spinner from './components/Spinner';
import Skeleton from './components/Skeleton';
import TypingIndicator from './components/TypingIndicator';
import FormattedText from './components/FormattedText';
import ThemeToggle from './components/ThemeToggle';
import WorkspaceSelect from './components/WorkspaceSelect';
import WorkspaceModal from './components/WorkspaceModal';
import DocumentViewModal from './components/DocumentViewModal';

// How fast the "typewriter" reveals queued text, independent of how large the
// chunks arriving over the network are (Gemini often sends a whole short answer
// as one chunk, which would otherwise just pop in instead of streaming in).
const REVEAL_INTERVAL_MS = 20;
// Textarea grows with the content up to ~6 lines, then scrolls internally instead of
// pushing the rest of the chat panel around.
const MAX_COMPOSER_HEIGHT = 150;

function formatTime(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export default function Dashboard() {
  const showToast = useToast();
  const navigate = useNavigate();
  const { workspaceId: routeWorkspaceId } = useParams();

  const [workspaces, setWorkspaces] = useState([]);
  const activeId = routeWorkspaceId || null;
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [toolCalls, setToolCalls] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [activityTab, setActivityTab] = useState('log');
  const [viewingDoc, setViewingDoc] = useState(null); // { filename, content, loading }
  const [deletingDocId, setDeletingDocId] = useState(null);

  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [quotaNotice, setQuotaNotice] = useState(null); // { model, resetsAt, availableModels }
  const [exhaustedModels, setExhaustedModels] = useState(() => new Set());
  const lastQuestionRef = useRef(null);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingWorkspaceData, setLoadingWorkspaceData] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const composerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const revealQueueRef = useRef('');
  const revealTimerRef = useRef(null);
  const revealMsgIdRef = useRef(null);
  const revealDoneResolveRef = useRef(null);

  // Reveals queued text a few characters at a time so the answer always appears to
  // "type" in, even when the network delivers it as one large chunk.
  function enqueueReveal(assistantMsgId, text) {
    revealMsgIdRef.current = assistantMsgId;
    revealQueueRef.current += text;
    if (revealTimerRef.current) return;
    revealTimerRef.current = setInterval(() => {
      if (!revealQueueRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        revealDoneResolveRef.current?.();
        revealDoneResolveRef.current = null;
        return;
      }
      // Speed up when a lot of text is backlogged, so a big chunk doesn't take forever to reveal.
      const step = Math.max(2, Math.ceil(revealQueueRef.current.length / 12));
      const next = revealQueueRef.current.slice(0, step);
      revealQueueRef.current = revealQueueRef.current.slice(step);
      const msgId = revealMsgIdRef.current;
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: m.content + next } : m)));
    }, REVEAL_INTERVAL_MS);
  }

  function waitForRevealDrain() {
    return new Promise((resolve) => {
      if (!revealTimerRef.current && !revealQueueRef.current) {
        resolve();
        return;
      }
      revealDoneResolveRef.current = resolve;
    });
  }

  function stopReveal() {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    revealTimerRef.current = null;
    revealQueueRef.current = '';
    revealDoneResolveRef.current = null;
  }

  useEffect(() => stopReveal, []);

  useEffect(() => {
    let cancelled = false;
    apiGet('/workspaces')
      .then((rows) => { if (!cancelled) setWorkspaces(rows); })
      .catch((err) => { if (!cancelled) setFetchError(err.message); })
      .finally(() => { if (!cancelled) setLoadingWorkspaces(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet('/models')
      .then(({ models, default: def }) => {
        if (cancelled) return;
        setAvailableModels(models);
        setSelectedModel((prev) => prev || def);
      })
      .catch(() => {}); // non-critical — the server falls back to its own default
    return () => { cancelled = true; };
  }, []);

  const sortedWorkspaces = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!routeWorkspaceId && sortedWorkspaces.length > 0) {
      navigate(`/dashboard/${sortedWorkspaces[0].id}`, { replace: true });
    }
  }, [sortedWorkspaces, routeWorkspaceId, navigate]);

  async function refreshWorkspaceData(id) {
    const [docs, msgs, calls, taskRows] = await Promise.all([
      apiGet(`/workspaces/${id}/documents`),
      apiGet(`/workspaces/${id}/chat`),
      apiGet(`/workspaces/${id}/tool-calls`),
      apiGet(`/workspaces/${id}/tasks`),
    ]);
    setDocuments(docs);
    setMessages(msgs);
    setToolCalls(calls);
    setTasks(taskRows);
    return { docs, msgs, calls, taskRows };
  }

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingWorkspaceData(true);
    setFetchError(null);
    setQuotaNotice(null);
    refreshWorkspaceData(activeId)
      .catch((err) => { if (!cancelled) setFetchError(err.message); })
      .finally(() => { if (!cancelled) setLoadingWorkspaceData(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, awaitingFirstToken]);

  async function createWorkspace(name) {
    const ws = await apiPost('/workspaces', { name });
    setWorkspaces((prev) => [...prev, ws]);
    navigate(`/dashboard/${ws.id}`);
    showToast(`Workspace "${ws.name}" created`, { type: 'success' });
  }

  async function processUpload(file) {
    setUploadingFile(file.name);
    setUploadPercent(0);
    try {
      let finalDoc = null;
      await apiUploadStream(`/workspaces/${activeId}/documents`, file, (event) => {
        if (event.type === 'progress') {
          setUploadPercent(event.percent);
        } else if (event.type === 'done') {
          finalDoc = event.document;
        } else if (event.type === 'error') {
          showToast(event.message, { type: 'error' });
        }
      });
      await refreshWorkspaceData(activeId);
      if (finalDoc?.deduped) {
        showToast(`"${file.name}" is already indexed in this workspace`, { type: 'info' });
      } else if (finalDoc) {
        const count = finalDoc.chunkCount ?? 0;
        showToast(`"${file.name}" uploaded — ${count} chunk${count === 1 ? '' : 's'} indexed`, { type: 'success' });
      }
    } catch (err) {
      showToast(err.message, { type: 'error' });
    } finally {
      setUploadingFile(null);
      setUploadPercent(0);
    }
  }

  function handleFileInputChange(e) {
    const file = e.target.files[0];
    if (file) processUpload(file);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  }

  async function viewDocument(doc) {
    setViewingDoc({ filename: doc.filename, content: '', loading: true });
    try {
      const data = await apiGet(`/workspaces/${activeId}/documents/${doc.id}/content`);
      setViewingDoc({ filename: data.filename, content: data.content, loading: false });
    } catch (err) {
      showToast(err.message, { type: 'error' });
      setViewingDoc(null);
    }
  }

  async function removeDocument(doc) {
    if (!window.confirm(`Remove "${doc.filename}" from this workspace? This can't be undone.`)) return;
    setDeletingDocId(doc.id);
    try {
      await apiDelete(`/workspaces/${activeId}/documents/${doc.id}`);
      await refreshWorkspaceData(activeId);
      showToast(`"${doc.filename}" removed`, { type: 'info' });
    } catch (err) {
      showToast(err.message, { type: 'error' });
    } finally {
      setDeletingDocId(null);
    }
  }

  async function runChat(asked, modelOverride) {
    setSending(true);
    setAwaitingFirstToken(true);
    setQuotaNotice(null);
    lastQuestionRef.current = asked;

    const assistantMsgId = `assistant-${Date.now()}`;
    let assistantAdded = false;
    let citations = [];
    let hitQuota = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await apiPostStream(
        `/workspaces/${activeId}/chat`,
        { message: asked, model: modelOverride || selectedModel },
        (event) => {
          if (event.type === 'citations') {
            citations = event.citations;
          } else if (event.type === 'delta') {
            setAwaitingFirstToken(false);
            if (!assistantAdded) {
              assistantAdded = true;
              setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '', citations: [] }]);
            }
            enqueueReveal(assistantMsgId, event.text);
          } else if (event.type === 'tool_call') {
            showToast(
              event.status === 'success' ? `Tool "${event.name}" executed` : `Tool "${event.name}" failed`,
              { type: event.status === 'success' ? 'success' : 'error' }
            );
          } else if (event.type === 'quota_exceeded') {
            hitQuota = true;
            setAwaitingFirstToken(false);
            setQuotaNotice(event);
            setExhaustedModels((prev) => new Set(prev).add(event.model));
          } else if (event.type === 'error') {
            showToast(event.message, { type: 'error' });
          } else if (event.type === 'done') {
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, citations } : m)));
          }
        },
        { signal: controller.signal }
      );
      // Let the typewriter finish revealing whatever's queued before syncing with the DB.
      await waitForRevealDrain();
      // Reconciles with the DB (real message ids, and any tool's effect on tasks/tool log/doc stats).
      // A quota hit never reached the point of saving an assistant reply, so nothing new to sync.
      if (!hitQuota) await refreshWorkspaceData(activeId);
    } catch (err) {
      if (err.name === 'AbortError') {
        stopReveal();
        showToast('Message cancelled', { type: 'info' });
        await refreshWorkspaceData(activeId);
      } else {
        showToast(err.message, { type: 'error' });
      }
    } finally {
      abortControllerRef.current = null;
      setSending(false);
      setAwaitingFirstToken(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const asked = question.trim();
    if (!asked || sending || !activeId || documents.length === 0) return;
    setQuestion('');
    if (composerRef.current) composerRef.current.style.height = 'auto';
    setMessages((prev) => [...prev, { id: `pending-${Date.now()}`, role: 'user', content: asked }]);
    await runChat(asked);
  }

  // Retries the same question against a different model after a quota_exceeded notice —
  // the user's question is already on screen, so no need to touch the composer or history.
  async function retryWithModel(model) {
    setSelectedModel(model);
    if (!lastQuestionRef.current) return;
    await runChat(lastQuestionRef.current, model);
  }

  function cancelMessage() {
    abortControllerRef.current?.abort();
  }

  function handleComposerKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  }

  function handleComposerInput(e) {
    setQuestion(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }

  if (loadingWorkspaces) {
    return <PageLoader label="Loading your workspaces…" />;
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || null;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  const hasDocuments = documents.length > 0;
  const chatDisabled = !activeId || !hasDocuments;

  return (
    <div className="dashboard fade-in">
      <header>
        <h1>AI Doc Assistant</h1>
        <div className="workspace-switcher">
          <WorkspaceSelect
            workspaces={sortedWorkspaces}
            activeId={activeId}
            onChange={(id) => navigate(`/dashboard/${id}`)}
            disabled={sortedWorkspaces.length === 0}
          />
          <button type="button" className="btn-secondary" onClick={() => setShowWorkspaceModal(true)}>
            Add Workspace
          </button>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {showWorkspaceModal && (
        <WorkspaceModal
          existingNames={workspaces.map((w) => w.name)}
          onClose={() => setShowWorkspaceModal(false)}
          onCreate={createWorkspace}
        />
      )}

      {viewingDoc && (
        <DocumentViewModal
          filename={viewingDoc.filename}
          content={viewingDoc.content}
          loading={viewingDoc.loading}
          onClose={() => setViewingDoc(null)}
        />
      )}

      <div className="workspace-summary">
        <div>
          <span className="eyebrow">Active workspace</span>
          <div className="workspace-title">{activeWorkspace?.name || 'No workspace yet'}</div>
        </div>
        <div className="stat-row">
          <div className="stat"><strong>{documents.length}</strong><span>Documents</span></div>
          <div className="stat"><strong>{totalChunks}</strong><span>Chunks indexed</span></div>
          <div className="stat"><strong>{messages.length}</strong><span>Messages</span></div>
          <div className="stat"><strong>{toolCalls.length}</strong><span>Tool calls</span></div>
        </div>
      </div>

      {fetchError && <div className="error-banner">{fetchError}</div>}

      <div className="grid fade-in" key={activeId}>
        <section className="card documents-panel">
          <h2>Documents</h2>
          <div
            className={`dropzone ${dragActive ? 'drag-active' : ''} ${!activeId ? 'disabled' : ''}`}
            onDragOver={(e) => { if (activeId) { e.preventDefault(); setDragActive(true); } }}
            onDragLeave={() => setDragActive(false)}
            onDrop={activeId ? handleDrop : (e) => e.preventDefault()}
            onClick={() => {
              if (!activeId) {
                showToast('Create or select a workspace first', { type: 'info' });
                return;
              }
              fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              hidden
              onChange={handleFileInputChange}
            />
            <div className="dropzone-button">
              <UploadIcon />
              <span>Upload document</span>
            </div>
            <p className="dropzone-hint">Drop files here or click · PDF, TXT, MD, DOCX</p>
          </div>

          {uploadingFile && (
            <div className="upload-progress">
              <div className="upload-progress-row">
                <Spinner size={14} />
                <span>Processing {uploadingFile}… {uploadPercent}%</span>
              </div>
              <div className="upload-progress-bar">
                <div className="upload-progress-fill" style={{ width: `${uploadPercent}%` }} />
              </div>
            </div>
          )}

          <div className="panel-scroll">
            {loadingWorkspaceData ? (
              <Skeleton rows={3} />
            ) : documents.length === 0 ? (
              <p className="empty-hint">No documents in this workspace yet.<br />Upload one to start asking questions.</p>
            ) : (
              <ul className="fade-list doc-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <div className="doc-row-top">
                      <span className="doc-name">{doc.filename}</span>
                      <span className="doc-meta">{doc.chunk_count ?? 0} chunks</span>
                    </div>
                    <div className="doc-row-actions">
                      <button type="button" className="link-button" onClick={() => viewDocument(doc)}>
                        View
                      </button>
                      <button
                        type="button"
                        className="link-button link-button-danger"
                        onClick={() => removeDocument(doc)}
                        disabled={deletingDocId === doc.id}
                      >
                        {deletingDocId === doc.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card chat-panel">
          <div className="card-header-row">
            <h2>Assistant</h2>
            <span className="hint-text">Answers only from this workspace's documents</span>
          </div>
          <div className="chat-history">
            {messages.length === 0 && !awaitingFirstToken && !sending ? (
              <div className="chat-empty">
                {!activeId ? (
                  <>
                    <p>Create a workspace to get started.</p>
                    <button type="button" className="btn-secondary" onClick={() => setShowWorkspaceModal(true)}>
                      Create workspace
                    </button>
                  </>
                ) : hasDocuments ? (
                  <>
                    <p>Ask a question about the documents in <strong>{activeWorkspace?.name || 'No workspace yet'}</strong>.</p>
                    <p>Answers cite their sources; if the documents don't say, the assistant will tell you.</p>
                  </>
                ) : (
                  <>
                    <p>Upload a document to <strong>{activeWorkspace?.name || 'this workspace'}</strong> before asking questions.</p>
                    <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                      Upload a document
                    </button>
                  </>
                )}
                <p className="chat-tip">
                  Tip: you can also ask it to act — try "save a task to buy milk by Friday" or
                  "send a summary to Discord".
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-message ${m.role}`}>
                  <strong>{m.role}</strong>
                  <FormattedText text={m.content} />
                  {m.citations && m.citations.length > 0 && (
                    <div className="citations">Source: {m.citations.map((c) => c.filename).join(', ')}</div>
                  )}
                </div>
              ))
            )}
            {awaitingFirstToken && <TypingIndicator />}
            {quotaNotice && (
              <div className="quota-banner">
                <p>
                  <strong>{quotaNotice.model}</strong> has hit its free-tier daily limit. Resets{' '}
                  {new Date(quotaNotice.resetsAt).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                  .
                </p>
                {quotaNotice.availableModels.length > 0 && (
                  <div className="quota-banner-actions">
                    <span>Try instead:</span>
                    {quotaNotice.availableModels.map((m) => (
                      <button key={m} type="button" className="btn-secondary" onClick={() => retryWithModel(m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="composer">
            <textarea
              ref={composerRef}
              rows={1}
              placeholder={hasDocuments ? 'Ask a question about this workspace\'s documents' : 'Upload a document to start chatting'}
              value={question}
              onChange={handleComposerInput}
              onKeyDown={handleComposerKeyDown}
              disabled={chatDisabled}
            />
            <div className="composer-toolbar">
              {availableModels.length > 0 ? (
                <select
                  className="model-pill"
                  value={selectedModel || ''}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  title="Model used for the next question"
                  disabled={chatDisabled}
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m} disabled={exhaustedModels.has(m)}>
                      {exhaustedModels.has(m) ? `${m} (limit reached)` : m}
                    </option>
                  ))}
                </select>
              ) : <span />}
              {sending ? (
                <button type="button" className="send-btn cancel" onClick={cancelMessage} aria-label="Cancel">
                  <StopIcon />
                </button>
              ) : (
                <button
                  className="send-btn"
                  type="submit"
                  disabled={!question.trim() || chatDisabled}
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card activity-panel">
          <div className="card-header-row">
            <h2>Activity</h2>
            <div className="tab-switch">
              <button
                type="button"
                className={activityTab === 'log' ? 'tab active' : 'tab'}
                onClick={() => setActivityTab('log')}
              >
                Tool log
              </button>
              <button
                type="button"
                className={activityTab === 'tasks' ? 'tab active' : 'tab'}
                onClick={() => setActivityTab('tasks')}
              >
                Tasks
              </button>
            </div>
          </div>

          <div className="panel-scroll">
            {loadingWorkspaceData ? (
              <Skeleton rows={3} />
            ) : activityTab === 'log' ? (
              toolCalls.length === 0 ? (
                <p className="empty-hint">
                  No tool calls yet. Try asking the assistant to "save a task to …" or
                  "send a summary to Discord" — it'll show up here.
                </p>
              ) : (
                <ul className="activity-list">
                  {toolCalls.map((tc) => (
                    <li key={tc.id} className="activity-item">
                      <div className="activity-item-top">
                        <span className={`status-dot ${tc.status}`} />
                        <strong>{tc.tool_name}</strong>
                        <span className="activity-time">{formatTime(tc.created_at)}</span>
                      </div>
                      <div className="activity-detail">{JSON.stringify(tc.arguments)}</div>
                    </li>
                  ))}
                </ul>
              )
            ) : tasks.length === 0 ? (
              <p className="empty-hint">No tasks saved. Try "save a task to buy milk by Friday".</p>
            ) : (
              <ul className="activity-list">
                {tasks.map((t) => (
                  <li key={t.id} className="activity-item">
                    <strong>{t.title}</strong>
                    {t.due_date && <span className="activity-time">Due {t.due_date}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
