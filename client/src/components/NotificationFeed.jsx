import React from 'react';
import api from '../api';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationFeed({ notifications, onSelect, onMarkRead, onRefresh }) {
  const handleClick = async (n) => {
    const convId = n.conversation_id ?? n.conversationId;
    if (convId) onSelect({ ...n, conversationId: convId });
    if (n.id && !n.read) {
      try {
        await api(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
        onMarkRead?.();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div style={styles.wrap}>
      <ul style={styles.list}>
        {notifications.length === 0 && (
          <li style={styles.empty}>No notifications yet.</li>
        )}
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => handleClick(n)}
              style={{
                ...styles.item,
                ...(n.read ? {} : styles.itemUnread),
              }}
            >
              <span style={styles.text}>{n.text}</span>
              <span style={styles.time}>{formatTime(n.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
      {notifications.length > 0 && (
        <button type="button" onClick={onRefresh} style={styles.refreshBtn}>
          Refresh
        </button>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: 'relative' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  empty: { padding: 4, color: '#6b7280', fontSize: 13 },
  item: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    background: 'none',
    marginBottom: 2,
    cursor: 'pointer',
    fontSize: 13,
  },
  itemUnread: { background: '#eff6ff', fontWeight: 500 },
  text: { display: 'block' },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  refreshBtn: { marginTop: 8, padding: '4px 8px', background: 'none', border: 'none', color: '#6b7280', fontSize: 12 },
};
