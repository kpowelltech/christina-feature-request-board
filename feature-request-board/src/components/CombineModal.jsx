import { useState, useEffect, useMemo } from 'react';

/**
 * CombineModal - Modal for combining/merging multiple feature request entries
 * under a shared topic (and optionally category).
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onCombine - Callback with (ids, topic, category) when combine is confirmed
 * @param {array} selectedEntries - The selected request objects to combine
 * @param {array} existingTopics - List of existing topics for autocomplete/dropdown
 * @param {boolean} isAiChannel - Whether this is for AI feedback channel
 */
export default function CombineModal({ isOpen, onClose, onCombine, selectedEntries = [], existingTopics = [], categories = [], isAiChannel = false }) {
  const [targetTopic, setTargetTopic] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [isCombining, setIsCombining] = useState(false);
  const [error, setError] = useState(null);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Check if entries span multiple categories
  const uniqueCategories = useMemo(() => {
    return [...new Set(selectedEntries.map(r => r.category).filter(Boolean))];
  }, [selectedEntries]);

  const isMultiCategory = uniqueCategories.length > 1;

  // Check if all entries already share the same topic
  const allSameTopic = useMemo(() => {
    const topics = selectedEntries.map(r => r.topic || r.requestGroup).filter(Boolean);
    return topics.length > 0 && topics.every(t => t === topics[0]);
  }, [selectedEntries]);

  // Find the most common topic among selected entries
  const mostCommonTopic = useMemo(() => {
    const topicCounts = {};
    selectedEntries.forEach(r => {
      const t = r.topic || r.requestGroup;
      if (t) topicCounts[t] = (topicCounts[t] || 0) + 1;
    });
    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : '';
  }, [selectedEntries]);

  // Find the most common category
  const mostCommonCategory = useMemo(() => {
    const catCounts = {};
    selectedEntries.forEach(r => {
      if (r.category) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
    });
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : '';
  }, [selectedEntries]);

  // Filter topics for dropdown based on input
  // Show all when dropdown first opens, filter as user types
  const [topicFilterText, setTopicFilterText] = useState('');
  const filteredTopics = useMemo(() => {
    if (!topicFilterText) return existingTopics;
    const lower = topicFilterText.toLowerCase();
    return existingTopics.filter(t => t.toLowerCase().includes(lower));
  }, [topicFilterText, existingTopics]);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen && selectedEntries.length > 0) {
      setTargetTopic(mostCommonTopic);
      setTopicFilterText('');
      setTargetCategory(mostCommonCategory);
      setError(null);
      setShowTopicDropdown(false);
    }
  }, [isOpen, selectedEntries.length]);

  if (!isOpen || selectedEntries.length < 1) return null;

  const handleCombine = async () => {
    if (!targetTopic.trim()) {
      setError('Please enter a target topic');
      return;
    }

    setIsCombining(true);
    setError(null);

    try {
      const ids = selectedEntries.map(r => r.id);
      await onCombine(ids, targetTopic.trim(), targetCategory || null);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to combine entries');
    } finally {
      setIsCombining(false);
    }
  };

  const handleCancel = () => {
    if (!isCombining) {
      setError(null);
      onClose();
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    background: '#15161E',
    border: '1px solid #1E2030',
    borderRadius: 4,
    color: '#E2E4EC',
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px 0' }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#13141A', border: '1px solid #2A2C3A', borderRadius: 10, padding: 28, width: 640, maxWidth: '95vw', margin: 'auto' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20, borderBottom: '1px solid #1E2030', paddingBottom: 16 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#E2E4EC', marginBottom: 4 }}>
            {selectedEntries.length === 1 ? 'Move Entry to Topic' : `Combine ${selectedEntries.length} Entries`}
          </h2>
          <p style={{ fontSize: 10, color: '#6B7280' }}>
            {selectedEntries.length === 1 ? 'Reassign this entry to a different topic' : 'Group these entries under a single topic so they appear together'}
          </p>
        </div>

        {allSameTopic && (
          <div style={{ padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#F59E0B' }}>These entries are already grouped under the same topic.</p>
          </div>
        )}

        {/* Body */}
        <div style={{ maxHeight: 'calc(100vh - 20rem)', overflowY: 'auto' }}>
          {/* Selected entries list */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Selected Entries</label>
            <div style={{ background: '#0E0F14', border: '1px solid #1E2030', borderRadius: 6, maxHeight: 180, overflowY: 'auto' }}>
              {selectedEntries.map((r) => (
                <div key={r.id} style={{ padding: '8px 12px', borderBottom: '1px solid #1A1B24', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ color: '#C4C7D4', fontSize: 11, fontWeight: 500 }}>
                        {r.merchant !== 'Unknown' ? r.merchant : '(merchant TBD)'}
                      </span>
                      {r.topic && (
                        <span style={{ fontSize: 9, color: '#4B5563', background: '#1E2030', padding: '1px 6px', borderRadius: 4 }}>
                          {r.topic}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.request?.slice(0, 100)}{r.request?.length > 100 ? '...' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: '#4B5563', flexShrink: 0 }}>
                    {r.category}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target topic */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={labelStyle}>
              Target Topic <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={targetTopic}
              onChange={(e) => { setTargetTopic(e.target.value); setTopicFilterText(e.target.value); }}
              onFocus={() => { setShowTopicDropdown(true); setTopicFilterText(''); }}
              onBlur={() => setTimeout(() => setShowTopicDropdown(false), 200)}
              style={inputStyle}
              placeholder="Enter topic name or select from existing..."
            />
            {showTopicDropdown && filteredTopics.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#15161E', border: '1px solid #2A2C3A', borderRadius: 4,
                maxHeight: 200, overflowY: 'auto', marginTop: 2
              }}>
                {filteredTopics.map(topic => (
                  <div
                    key={topic}
                    onMouseDown={() => { setTargetTopic(topic); setTopicFilterText(''); setShowTopicDropdown(false); }}
                    style={{
                      padding: '6px 12px', fontSize: 11,
                      color: topic === targetTopic ? '#A78BFA' : '#C4C7D4',
                      cursor: 'pointer',
                      background: topic === targetTopic ? 'rgba(124,106,247,0.08)' : 'transparent',
                      borderBottom: '1px solid #1A1B24'
                    }}
                    onMouseOver={(e) => { if (topic !== targetTopic) e.currentTarget.style.background = '#1E2030'; }}
                    onMouseOut={(e) => { if (topic !== targetTopic) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {topic}
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 9, color: '#4B5563', marginTop: 4 }}>
              Type to filter or select from existing topics
            </p>
          </div>

          {/* Target category */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={labelStyle}>
              Category
            </label>
            <input
              type="text"
              value={targetCategory}
              onChange={(e) => { setTargetCategory(e.target.value); setCategoryFilter(e.target.value); }}
              onFocus={() => { setShowCategoryDropdown(true); setCategoryFilter(''); }}
              onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
              style={inputStyle}
              placeholder="Select or type a new category..."
              maxLength={100}
            />
            {showCategoryDropdown && (() => {
              const filter = categoryFilter.toLowerCase();
              const filtered = filter
                ? categories.filter(c => c.toLowerCase().includes(filter))
                : categories;
              const exactMatch = categories.some(c => c.toLowerCase() === targetCategory.trim().toLowerCase());
              const showCreate = targetCategory.trim() && !exactMatch;
              return (filtered.length > 0 || showCreate) ? (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#15161E', border: '1px solid #2A2C3A', borderRadius: 4,
                  maxHeight: 200, overflowY: 'auto', marginTop: 2
                }}>
                  {filtered.map(cat => (
                    <div
                      key={cat}
                      onMouseDown={() => { setTargetCategory(cat); setCategoryFilter(''); setShowCategoryDropdown(false); }}
                      style={{
                        padding: '6px 12px', fontSize: 11,
                        color: cat === targetCategory ? '#A78BFA' : '#C4C7D4',
                        cursor: 'pointer',
                        background: cat === targetCategory ? 'rgba(124,106,247,0.08)' : 'transparent',
                        borderBottom: '1px solid #1A1B24'
                      }}
                      onMouseOver={(e) => { if (cat !== targetCategory) e.currentTarget.style.background = '#1E2030'; }}
                      onMouseOut={(e) => { if (cat !== targetCategory) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {cat}
                    </div>
                  ))}
                  {showCreate && (
                    <div
                      onMouseDown={() => { setTargetCategory(targetCategory.trim()); setCategoryFilter(''); setShowCategoryDropdown(false); }}
                      style={{
                        padding: '6px 12px', fontSize: 11,
                        color: '#34D399', cursor: 'pointer',
                        background: 'transparent',
                        borderTop: filtered.length > 0 ? '1px solid #2A2C3A' : 'none'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#1E2030'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      + Create "{targetCategory.trim()}"
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {isMultiCategory && (
              <p style={{ fontSize: 9, color: '#F59E0B', marginTop: 4 }}>
                Entries span {uniqueCategories.length} categories ({uniqueCategories.join(', ')})
              </p>
            )}
            <p style={{ fontSize: 9, color: '#4B5563', marginTop: 4 }}>
              Select an existing category or type to create a new one
            </p>
          </div>

          {error && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}>
              <p style={{ fontSize: 11, color: '#F87171' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 20, borderTop: '1px solid #1E2030' }}>
          <button
            onClick={handleCancel}
            disabled={isCombining}
            style={{
              background: '#1E2030', color: '#9CA3AF', border: '1px solid #2A2C3A',
              borderRadius: 5, padding: '8px 16px', fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              cursor: isCombining ? 'not-allowed' : 'pointer',
              opacity: isCombining ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCombine}
            disabled={isCombining || !targetTopic.trim()}
            style={{
              background: '#7C6AF7', color: '#fff', border: 'none',
              borderRadius: 5, padding: '8px 16px', fontSize: 11,
              fontFamily: "'DM Mono', monospace", fontWeight: 500,
              cursor: (isCombining || !targetTopic.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isCombining || !targetTopic.trim()) ? 0.5 : 1
            }}
          >
            {isCombining ? 'Saving...' : selectedEntries.length === 1 ? 'Move Entry' : `Combine ${selectedEntries.length} Entries`}
          </button>
        </div>
      </div>
    </div>
  );
}
