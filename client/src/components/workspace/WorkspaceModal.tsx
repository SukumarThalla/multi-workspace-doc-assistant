import { useEffect, useRef, useState } from 'react';
import Spinner from '../common/Spinner';

// existingNames: workspace names already taken by this user, so we can catch a
// duplicate before it ever reaches the server (case-insensitive).
export default function WorkspaceModal({ existingNames, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const trimmed = name.trim();
  const isDuplicate = trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trimmed || isDuplicate || creating) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-centered" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
        <div className="modal-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M12 11v4M10 13h4" />
          </svg>
        </div>
        <h2 id="workspace-modal-title">New workspace</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
              type="text"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing team"
            />
          </div>
          {isDuplicate && <p className="error">A workspace named "{trimmed}" already exists.</p>}
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!trimmed || isDuplicate || creating}>
              {creating ? <Spinner size={14} /> : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
