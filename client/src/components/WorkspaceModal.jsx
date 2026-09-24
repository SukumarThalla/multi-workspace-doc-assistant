import { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner';

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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
        <h2 id="workspace-modal-title">New workspace</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
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
