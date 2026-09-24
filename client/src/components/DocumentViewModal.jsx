import { useEffect } from 'react';
import Spinner from './Spinner';

// Shows the reassembled text of a document (there's no original file stored — only its
// chunked text — so this is exactly what retrieval actually searches over).
export default function DocumentViewModal({ filename, content, loading, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-view-title"
      >
        <h2 id="document-view-title">{filename}</h2>
        <div className="document-view-body">
          {loading ? (
            <div className="document-view-loading"><Spinner size={16} /> Loading…</div>
          ) : (
            <pre>{content}</pre>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
