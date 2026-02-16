import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { useSocket } from '../SocketContext';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatView({ conversationId, currentUserId, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const socket = useSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = useCallback(async () => {
    try {
      const data = await api(`/api/conversations/${conversationId}`);
      setConversation(data);
    } catch (e) {
      console.error(e);
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async (before = null) => {
    const q = before ? `?before=${encodeURIComponent(before)}&limit=50` : '?limit=50';
    try {
      const data = await api(`/api/conversations/${conversationId}/messages${q}`);
      if (before) {
        setMessages((prev) => [...data, ...prev]);
      } else {
        setMessages(data);
      }
      return data;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchConversation(), fetchMessages()]).then(([, msgs]) => {
      setLoading(false);
      if (msgs.length > 0) setTimeout(scrollToBottom, 100);
    });
  }, [conversationId, fetchConversation, fetchMessages]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      if (msg.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 50);
    };
    socket.on('message', onMessage);
    return () => socket.off('message', onMessage);
  }, [socket, conversationId]);

  const loadMore = async () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    const older = await fetchMessages(oldest.created_at);
    setLoadingMore(false);
    if (older.length > 0) messagesTopRef.current?.scrollIntoView({ block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');
    try {
      const msg = await api(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    } catch (err) {
      setBody(text);
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const conversationLabel = (conv) => {
    if (!conv) return 'Chat';
    if (conv.name) return conv.name;
    const others = (conv.participants || []).filter((p) => p.id !== currentUserId);
    return others.map((p) => p.display_name || p.email).join(', ') || 'Conversation';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button type="button" onClick={onBack} style={styles.backBtn}>
            ← Back
          </button>
          <span style={styles.headerTitle}>Loading…</span>
        </div>
        <div style={styles.loading}>Loading messages…</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          ← Back
        </button>
        <span style={styles.headerTitle}>{conversationLabel(conversation)}</span>
      </div>

      <div style={styles.messagesWrap}>
        <div ref={messagesTopRef} />
        {messages.length > 0 && (
          <div style={styles.loadMoreWrap}>
            <button type="button" onClick={loadMore} disabled={loadingMore} style={styles.loadMoreBtn}>
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.messageRow,
              ...(m.sender_id === currentUserId ? styles.messageRowSelf : {}),
            }}
          >
            <div style={{ ...styles.messageBubble, ...(m.sender_id === currentUserId ? styles.messageRowSelfBubble : {}) }}>
              {m.sender_id !== currentUserId && (
                <div style={styles.senderName}>{m.sender_name || m.sender_email}</div>
              )}
              <div style={styles.messageBody}>{m.body}</div>
              <div style={m.sender_id === currentUserId ? { ...styles.messageTime, ...styles.messageTimeSelf } : styles.messageTime}>
                {formatTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          style={styles.input}
          autoFocus
        />
        <button type="submit" disabled={sending || !body.trim()} style={styles.sendBtn}>
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  backBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14 },
  headerTitle: { fontWeight: 600, fontSize: 16 },
  loading: { padding: 24, textAlign: 'center', color: '#6b7280' },
  messagesWrap: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  loadMoreWrap: { display: 'flex', justifyContent: 'center', padding: 8 },
  loadMoreBtn: { padding: '6px 12px', fontSize: 13, background: '#f3f4f6', border: 'none', borderRadius: 6 },
  messageRow: { display: 'flex', justifyContent: 'flex-start' },
  messageRowSelf: { justifyContent: 'flex-end' },
  messageBubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: 12,
    background: '#f3f4f6',
  },
  messageRowSelfBubble: { background: '#2563eb', color: '#fff' },
  senderName: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  messageBody: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  messageTime: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  messageTimeSelf: { color: 'rgba(255,255,255,0.9)' },
  form: {
    flex: '0 0 auto',
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #e5e7eb',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
  },
  sendBtn: {
    padding: '10px 20px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
  },
};
