import { useState } from 'react';

/**
 * DeleteModal - Confirmation modal for deleting feature requests
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onConfirm - Callback when delete is confirmed
 * @param {object} request - The request object to delete
 */
export default function DeleteModal({ isOpen, onClose, onConfirm, request }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !request) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(request.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete request');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#13141A', border: '1px solid #2A2C3A', borderRadius: 10, padding: 28, width: 480, maxWidth: '95vw' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#E2E4EC', marginBottom: 4 }}>
            Delete Request
          </h2>
        </div>

        {/* Body */}
        <div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16, lineHeight: 1.5 }}>
            Are you sure you want to delete this feature request? This action cannot be undone.
          </p>

          <div style={{ background: '#0E0F14', border: '1px solid #1E2030', borderRadius: 6, padding: 14, marginBottom: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Merchant:</span>
              <p style={{ fontSize: 12, color: '#E2E4EC', marginTop: 2 }}>{request.merchant}</p>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Request:</span>
              <p style={{ fontSize: 12, color: '#E2E4EC', marginTop: 2, lineHeight: 1.4, maxHeight: 60, overflow: 'hidden' }}>{request.request}</p>
            </div>
          </div>

          {error && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#F87171' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            style={{
              background: '#1E2030',
              color: '#9CA3AF',
              border: '1px solid #2A2C3A',
              borderRadius: 5,
              padding: '8px 16px',
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              background: '#EF4444',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              padding: '8px 16px',
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.5 : 1
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
