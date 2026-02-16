import React from 'react';

function conversationLabel(conv, currentUserId) {
  if (conv.name) return conv.name;
  const others = (conv.participants || []).filter((p) => p.id !== currentUserId);
  if (others.length === 0) return 'Just you';
  return others.map((p) => p.display_name || p.email).join(', ') || 'Conversation';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ConversationList({ conversations, currentUserId, selectedId, onSelect }) {
  return (
    <ul style={styles.list}>
      {conversations.length === 0 && (
        <li style={styles.empty}>No conversations yet. Start one with &quot;New&quot;.</li>
      )}
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            style={{
              ...styles.item,
              ...(selectedId === c.id ? styles.itemSelected : {}),
            }}
          >
            <div style={styles.itemTitle}>{conversationLabel(c, currentUserId)}</div>
            {c.last_message_body && (
              <div style={styles.itemPreview}>
                {c.last_message_body.length > 40 ? `${c.last_message_body.slice(0, 40)}…` : c.last_message_body}
              </div>
            )}
            {c.last_message_at && (
              <div style={styles.itemTime}>{formatTime(c.last_message_at)}</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

const styles = {
  list: { listStyle: 'none', margin: 0, padding: 0 },
  empty: { padding: 12, color: '#6b7280', fontSize: 14 },
  item: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 8,
    background: 'none',
    marginBottom: 4,
    cursor: 'pointer',
  },
  itemSelected: { background: '#eff6ff', color: '#1d4ed8' },
  itemTitle: { fontWeight: 600, fontSize: 14 },
  itemPreview: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
};
