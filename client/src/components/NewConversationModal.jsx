import React, { useState, useEffect } from 'react';
import api from '../api';

export default function NewConversationModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  const toggleUser = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const conv = await api('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() || undefined, participantIds: selectedIds }),
      });
      onCreated(conv);
    } catch (err) {
      setError(err.message || 'Failed to create conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>New conversation</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}
          <label style={styles.label}>
            Group name (optional)
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team chat"
              style={styles.input}
            />
          </label>
          <div style={styles.label}>
            Add participants
            {users.length === 0 ? (
              <p style={styles.hint}>No other users yet. Create another account to start a group.</p>
            ) : (
              <ul style={styles.userList}>
                {users.map((u) => (
                  <li key={u.id}>
                    <label style={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                      />
                      <span>{u.display_name || u.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90vh',
    overflow: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: 18, fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', fontSize: 24, lineHeight: 1, color: '#6b7280', cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 14, marginBottom: 12 },
  label: { display: 'block', marginBottom: 16, fontSize: 14, fontWeight: 500 },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
  },
  hint: { margin: '8px 0 0', color: '#6b7280', fontSize: 13 },
  userList: { listStyle: 'none', margin: '8px 0 0', padding: 0 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8 },
  submitBtn: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500 },
};
