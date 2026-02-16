import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useSocket } from '../SocketContext';
import ConversationList from '../components/ConversationList';
import NotificationFeed from '../components/NotificationFeed';
import ChatView from '../components/ChatView';
import NewConversationModal from '../components/NewConversationModal';

export default function NotificationsPage() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewConv, setShowNewConv] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api('/api/conversations');
      setConversations(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api('/api/notifications');
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConversations(), fetchNotifications()]).finally(() => setLoading(false));
  }, [fetchConversations, fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    socket.on('message', (msg) => {
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== msg.conversation_id);
        const conv = prev.find((c) => c.id === msg.conversation_id);
        const updated = conv
          ? { ...conv, last_message_body: msg.body, last_message_at: msg.created_at, updated_at: msg.created_at }
          : { id: msg.conversation_id, last_message_body: msg.body, last_message_at: msg.created_at, updated_at: msg.created_at, participants: [] };
        const next = [updated, ...rest];
        next.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        return next;
      });
    });
    socket.on('notification', (n) => {
      setNotifications((prev) => [n, ...prev]);
    });
    return () => {
      socket.off('message');
      socket.off('notification');
    };
  }, [socket]);

  useEffect(() => {
    if (socket && selectedConversationId) {
      socket.emit('join_conversation', selectedConversationId);
      return () => socket.emit('leave_conversation', selectedConversationId);
    }
  }, [socket, selectedConversationId]);

  const handleConversationCreated = (conv) => {
    setConversations((prev) => [conv, ...prev]);
    setSelectedConversationId(conv.id);
    setShowNewConv(false);
  };

  const handleOpenConversation = (convId) => {
    setSelectedConversationId(convId);
  };

  const handleNotificationClick = (notification) => {
    setSelectedConversationId(notification.conversationId);
  };

  const refreshConversations = () => {
    fetchConversations();
  };
  const refreshNotifications = () => {
    fetchNotifications();
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Notifications & Chat</h1>
        <div style={styles.headerUser}>
          <span>{user?.display_name || user?.email}</span>
          <button type="button" onClick={logout} style={styles.logoutBtn}>
            Log out
          </button>
        </div>
      </header>

      <aside style={styles.sidebar}>
        <div style={styles.sidebarSection}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Conversations</h2>
            <button type="button" onClick={() => setShowNewConv(true)} style={styles.newBtn}>
              New
            </button>
          </div>
          <ConversationList
            conversations={conversations}
            currentUserId={user?.id}
            selectedId={selectedConversationId}
            onSelect={handleOpenConversation}
          />
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.feedSection}>
          <h2 style={styles.feedTitle}>Notification feed</h2>
          <NotificationFeed
            notifications={notifications}
            onSelect={handleNotificationClick}
            onMarkRead={refreshNotifications}
            onRefresh={refreshNotifications}
          />
        </div>
        <div style={styles.chatSection}>
          {selectedConversationId ? (
            <ChatView
              conversationId={selectedConversationId}
              currentUserId={user?.id}
              onBack={() => setSelectedConversationId(null)}
            />
          ) : (
            <div style={styles.emptyChat}>
              <p>Select a conversation or start a new one.</p>
            </div>
          )}
        </div>
      </main>

      {showNewConv && (
        <NewConversationModal
          onClose={() => setShowNewConv(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}

const styles = {
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas: '"header header" "sidebar main"',
    minHeight: '100vh',
  },
  header: {
    gridArea: 'header',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 600 },
  headerUser: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 },
  logoutBtn: { background: 'none', border: 'none', color: '#6b7280', padding: 4 },
  sidebar: {
    gridArea: 'sidebar',
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
  },
  sidebarSection: { padding: 16 },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sidebarTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' },
  newBtn: {
    padding: '6px 12px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
  },
  main: {
    gridArea: 'main',
    display: 'flex',
    flexDirection: 'column',
    background: '#f9fafb',
    overflow: 'hidden',
  },
  feedSection: {
    flex: '0 0 auto',
    padding: '12px 24px',
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    maxHeight: 200,
    overflow: 'auto',
  },
  feedTitle: { margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#374151' },
  chatSection: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
  emptyChat: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: 15,
  },
};
