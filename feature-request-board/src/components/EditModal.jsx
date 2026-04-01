import { useState, useEffect } from 'react';

/**
 * EditModal - Modal for editing feature request details
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onSave - Callback when save is confirmed
 * @param {object} request - The request object to edit
 * @param {array} existingTopics - List of existing topics for autocomplete
 * @param {boolean} isAiChannel - Whether this is for AI feedback channel
 */
export default function EditModal({ isOpen, onClose, onSave, request, existingTopics = [], categories = [], isAiChannel = false }) {
  const [formData, setFormData] = useState({
    merchant: '',
    mrr: '',
    arr: '',
    category: '',
    topic: '',
    request: '',
    context: '',
    status: 'pending'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const statuses = ['pending', 'in_progress', 'qa', 'done', 'blocked'];

  // Initialize form when request changes
  useEffect(() => {
    if (request) {
      setFormData({
        merchant: request.merchant || '',
        mrr: request.mrr || '',
        arr: request.arr || '',
        category: request.category || '',
        topic: request.topic || '',
        request: request.request || '',
        context: request.context || '',
        status: request.status || 'pending'
      });
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate ARR when MRR changes
    if (field === 'mrr') {
      const mrrValue = parseInt(value) || 0;
      setFormData(prev => ({
        ...prev,
        arr: mrrValue * 12
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Prepare update data
      const updateData = {
        id: request.id,
        merchant: formData.merchant,
        mrr: parseInt(formData.mrr) || 0,
        arr: parseInt(formData.arr) || 0,
        category: formData.category.trim(),
        topic: formData.topic || null,
        request: formData.request,
        context: formData.context || null,
        status: formData.status
      };

      await onSave(updateData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update request');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
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
            Edit Feature Request
          </h2>
          <p style={{ fontSize: 10, color: '#6B7280' }}>ID: {request.id}</p>
        </div>

        {/* Body */}
        <div style={{ maxHeight: 'calc(100vh - 16rem)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Merchant */}
            <div>
              <label style={labelStyle}>
                Merchant <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.merchant}
                onChange={(e) => handleChange('merchant', e.target.value)}
                style={inputStyle}
                placeholder="Merchant name"
              />
            </div>

            {/* MRR and ARR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  MRR ($)
                </label>
                <input
                  type="number"
                  value={formData.mrr}
                  onChange={(e) => handleChange('mrr', e.target.value)}
                  style={inputStyle}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  ARR ($)
                </label>
                <input
                  type="number"
                  value={formData.arr}
                  onChange={(e) => handleChange('arr', e.target.value)}
                  style={{ ...inputStyle, background: '#0E0F14' }}
                  placeholder="0"
                  min="0"
                  readOnly
                />
                <p style={{ fontSize: 9, color: '#4B5563', marginTop: 4 }}>Auto-calculated (MRR × 12)</p>
              </div>
            </div>

            {/* Category */}
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>
                Category <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => { handleChange('category', e.target.value); setCategoryFilter(e.target.value); }}
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
                const exactMatch = categories.some(c => c.toLowerCase() === formData.category.trim().toLowerCase());
                const showCreate = formData.category.trim() && !exactMatch;
                return (filtered.length > 0 || showCreate) ? (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: '#15161E', border: '1px solid #2A2C3A', borderRadius: 4,
                    maxHeight: 200, overflowY: 'auto', marginTop: 2
                  }}>
                    {filtered.map(cat => (
                      <div
                        key={cat}
                        onMouseDown={() => { handleChange('category', cat); setCategoryFilter(''); setShowCategoryDropdown(false); }}
                        style={{
                          padding: '6px 12px', fontSize: 11,
                          color: cat === formData.category ? '#A78BFA' : '#C4C7D4',
                          cursor: 'pointer',
                          background: cat === formData.category ? 'rgba(124,106,247,0.08)' : 'transparent',
                          borderBottom: '1px solid #1A1B24'
                        }}
                        onMouseOver={(e) => { if (cat !== formData.category) e.currentTarget.style.background = '#1E2030'; }}
                        onMouseOut={(e) => { if (cat !== formData.category) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {cat}
                      </div>
                    ))}
                    {showCreate && (
                      <div
                        onMouseDown={() => { handleChange('category', formData.category.trim()); setCategoryFilter(''); setShowCategoryDropdown(false); }}
                        style={{
                          padding: '6px 12px', fontSize: 11,
                          color: '#34D399', cursor: 'pointer',
                          background: 'transparent',
                          borderTop: filtered.length > 0 ? '1px solid #2A2C3A' : 'none'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#1E2030'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        + Create "{formData.category.trim()}"
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
              <p style={{ fontSize: 9, color: '#4B5563', marginTop: 4 }}>
                Select an existing category or type to create a new one
              </p>
            </div>

            {/* Topic (dynamic/freeform subtopic) */}
            <div>
              <label style={labelStyle}>
                Topic (Subtopic)
              </label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => handleChange('topic', e.target.value)}
                style={inputStyle}
                placeholder="Auto-assigned or enter manually (e.g., Welcome Flow, Abandon Cart)"
              />
              <p style={{ fontSize: 9, color: '#4B5563', marginTop: 4 }}>
                Subtopics are automatically assigned by AI or can be manually entered
              </p>
            </div>

            {/* Request */}
            <div>
              <label style={labelStyle}>
                Request <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                value={formData.request}
                onChange={(e) => handleChange('request', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                placeholder="Feature request description"
              />
            </div>

            {/* Context */}
            <div>
              <label style={labelStyle}>
                Context
              </label>
              <textarea
                value={formData.context}
                onChange={(e) => handleChange('context', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                placeholder="Additional context or summary"
              />
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                style={inputStyle}
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: '#F87171' }}>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 20, borderTop: '1px solid #1E2030' }}>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            style={{
              background: '#1E2030',
              color: '#9CA3AF',
              border: '1px solid #2A2C3A',
              borderRadius: 5,
              padding: '8px 16px',
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.merchant || !formData.category || !formData.request}
            style={{
              background: '#60A5FA',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              padding: '8px 16px',
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              cursor: (isSaving || !formData.merchant || !formData.category || !formData.request) ? 'not-allowed' : 'pointer',
              opacity: (isSaving || !formData.merchant || !formData.category || !formData.request) ? 0.5 : 1
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
