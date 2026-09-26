import { useEffect, useState } from 'react';

// Opt-in cross-workspace sharing: pick another workspace (in this same account) to grant
// read access to this document's content during retrieval, without touching default isolation.
export default function ShareDocumentModal({ doc, workspaces, currentWorkspaceId, onClose, onShare }) {
  const [sharingId, setSharingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const others = workspaces.filter((w) => w.id !== currentWorkspaceId);

  async function handleShare(targetWorkspaceId) {
    setSharingId(targetWorkspaceId);
    setError(null);
    try {
      await onShare(targetWorkspaceId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSharingId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
        <h2 id="share-modal-title">Share "{doc.filename}"</h2>
        {others.length === 0 ? (
          <p className="empty-hint">Create another workspace first to share a document into it.</p>
        ) : (
          <ul className="share-list">
            {others.map((w) => (
              <li key={w.id}>
                <span>{w.name}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={sharingId === w.id}
                  onClick={() => handleShare(w.id)}
                >
                  {sharingId === w.id ? 'Sharing…' : 'Share'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
