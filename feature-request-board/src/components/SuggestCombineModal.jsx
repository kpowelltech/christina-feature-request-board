import { useState } from 'react';

/**
 * SuggestCombineModal - Shows AI-generated merge suggestions and lets user apply them
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onApply - Callback with (ids, topic) for each accepted suggestion
 * @param {string} channel - "product" or "ai"
 */
export default function SuggestCombineModal({ isOpen, onClose, onApply, channel }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    try {
      const response = await fetch('/api/requests/suggest-combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get suggestions');
      }

      const result = await response.json();
      setSuggestions(result.suggestions || []);
      // Select all by default
      setSelectedSuggestions(new Set(result.suggestions?.map((_, i) => i) || []));
      setFetched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSuggestion = (index) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    try {
      const toApply = suggestions.filter((_, i) => selectedSuggestions.has(i));
      for (const suggestion of toApply) {
        await onApply(suggestion.ids, suggestion.targetTopic);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply suggestions');
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    if (!applying) {
      setSuggestions([]);
      setFetched(false);
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px 0' }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#13141A', border: '1px solid #2A2C3A', borderRadius: 10, padding: 28, width: 700, maxWidth: '95vw', margin: 'auto' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20, borderBottom: '1px solid #1E2030', paddingBottom: 16 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#E2E4EC', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            AI Merge Suggestions
          </h2>
          <p style={{ fontSize: 10, color: '#6B7280' }}>
            Claude analyzes your entries and suggests which ones should be grouped together
          </p>
        </div>

        {/* Body */}
        <div style={{ maxHeight: 'calc(100vh - 18rem)', overflowY: 'auto' }}>
          {!fetched && !loading && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
                Click below to scan all entries in #{channel === 'ai' ? 'ai-feedback' : 'product'} for merge opportunities
              </p>
              <button
                onClick={fetchSuggestions}
                className="action-btn ai-glow"
                style={{
                  background: 'rgba(124,106,247,0.15)', color: '#A78BFA',
                  border: '1px solid #7C6AF740', padding: '10px 24px', fontSize: 12, fontWeight: 500
                }}
              >
                Scan for Merge Suggestions
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 12, color: '#A78BFA', marginBottom: 8 }}>Analyzing entries with AI...</div>
              <div style={{ fontSize: 10, color: '#4B5563' }}>This may take a few seconds</div>
            </div>
          )}

          {error && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#F87171' }}>{error}</p>
            </div>
          )}

          {fetched && !loading && suggestions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>No merge suggestions found. Your entries look well-organized!</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestions.map((suggestion, index) => {
                const isChecked = selectedSuggestions.has(index);
                return (
                  <div
                    key={index}
                    style={{
                      background: isChecked ? 'rgba(124,106,247,0.05)' : '#0E0F14',
                      border: `1px solid ${isChecked ? '#7C6AF730' : '#1E2030'}`,
                      borderRadius: 6, padding: 14, transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSuggestion(index)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#7C6AF7', marginTop: 2, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ color: '#A78BFA', fontSize: 12, fontWeight: 600 }}>
                            {suggestion.targetTopic}
                          </span>
                          <span className="badge" style={{ background: 'rgba(124,106,247,0.12)', color: '#A78BFA', fontSize: 9 }}>
                            {suggestion.ids.length} entries
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8, lineHeight: 1.5 }}>
                          {suggestion.reason}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(suggestion.entries || []).map(entry => (
                            <div key={entry.id} style={{
                              background: '#15161E', border: '1px solid #1E2030', borderRadius: 4,
                              padding: '4px 8px', fontSize: 10, maxWidth: 280
                            }}>
                              <span style={{ color: '#C4C7D4', fontWeight: 500 }}>{entry.merchant}</span>
                              {entry.topic && entry.topic !== suggestion.targetTopic && (
                                <span style={{ color: '#4B5563', marginLeft: 4 }}>({entry.topic})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 20, borderTop: '1px solid #1E2030' }}>
          <button
            onClick={handleClose}
            disabled={applying}
            style={{
              background: '#1E2030', color: '#9CA3AF', border: '1px solid #2A2C3A',
              borderRadius: 5, padding: '8px 16px', fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              cursor: applying ? 'not-allowed' : 'pointer',
              opacity: applying ? 0.5 : 1
            }}
          >
            {suggestions.length > 0 ? 'Cancel' : 'Close'}
          </button>
          {suggestions.length > 0 && selectedSuggestions.size > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              style={{
                background: '#7C6AF7', color: '#fff', border: 'none',
                borderRadius: 5, padding: '8px 16px', fontSize: 11,
                fontFamily: "'DM Mono', monospace", fontWeight: 500,
                cursor: applying ? 'not-allowed' : 'pointer',
                opacity: applying ? 0.5 : 1
              }}
            >
              {applying ? 'Applying...' : `Apply ${selectedSuggestions.size} Suggestion${selectedSuggestions.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
