import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDb, getDb } from './db.js';
import { authMiddleware, hashPassword, verifyPassword, signToken, verifyToken } from './auth.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ----- Auth -----
app.post('/api/register', (req, res) => {
  const db = getDb();
  const { email, password, displayName } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const hash = hashPassword(password);
    const stmt = db.prepare(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
    );
    const result = stmt.run(email, hash, displayName || null);
    const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = signToken({ userId: user.id, email: user.email });
    return res.json({ user, token });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }
});

app.post('/api/login', (req, res) => {
  const db = getDb();
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const { password_hash, ...safe } = user;
  const token = signToken({ userId: safe.id, email: safe.email });
  return res.json({ user: safe, token });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/users', authMiddleware, (req, res) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, email, display_name, created_at FROM users WHERE id != ? ORDER BY display_name, email'
  ).all(req.userId);
  res.json(users);
});

// ----- Conversations -----
app.get('/api/conversations', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.id, c.name, c.created_at, c.updated_at,
           (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_body,
           (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
    FROM conversations c
    INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(req.userId);
  const withParticipants = rows.map((row) => {
    const participants = db.prepare(`
      SELECT u.id, u.email, u.display_name
      FROM users u
      INNER JOIN conversation_participants cp ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(row.id);
    return { ...row, participants };
  });
  res.json(withParticipants);
});

app.post('/api/conversations', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { name, participantIds } = req.body || {};
    const rawIds = Array.isArray(participantIds) ? participantIds : [];
    const participantIdsAsNumbers = rawIds.map((id) => (typeof id === 'number' ? id : parseInt(id, 10))).filter((id) => !Number.isNaN(id));
    const userIds = [...new Set([Number(req.userId), ...participantIdsAsNumbers])];
    const ins = db.prepare('INSERT INTO conversations (name) VALUES (?)');
    const result = ins.run(name ? String(name).trim() || null : null);
    const convId = result.lastInsertRowid;
    if (!convId) {
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
    const addPart = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
    for (const uid of userIds) {
      addPart.run(convId, uid);
    }
    const conv = db.prepare('SELECT id, name, created_at, updated_at FROM conversations WHERE id = ?').get(convId);
    const participants = db.prepare(`
      SELECT u.id, u.email, u.display_name FROM users u
      INNER JOIN conversation_participants cp ON cp.user_id = u.id WHERE cp.conversation_id = ?
    `).all(convId);
    return res.status(201).json({ ...conv, participants });
  } catch (err) {
    console.error('POST /api/conversations error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create conversation' });
  }
});

app.get('/api/conversations/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const conv = db.prepare(`
    SELECT c.id, c.name, c.created_at, c.updated_at FROM conversations c
    INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
    WHERE c.id = ?
  `).get(req.userId, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const participants = db.prepare(`
    SELECT u.id, u.email, u.display_name FROM users u
    INNER JOIN conversation_participants cp ON cp.user_id = u.id WHERE cp.conversation_id = ?
  `).all(conv.id);
  res.json({ ...conv, participants });
});

// ----- Messages -----
app.get('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const db = getDb();
  const conv = db.prepare(`
    SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
  `).get(req.params.id, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const before = req.query.before || null;
  let rows;
  if (before) {
    rows = db.prepare(`
      SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
             u.email AS sender_email, u.display_name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ? AND m.created_at < ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(req.params.id, before, limit);
  } else {
    rows = db.prepare(`
      SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
             u.email AS sender_email, u.display_name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(req.params.id, limit);
  }
  const messages = rows.reverse();
  res.json(messages);
});

app.post('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const db = getDb();
  const { body } = req.body || {};
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Message body required' });
  }
  const conv = db.prepare(`
    SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
  `).get(req.params.id, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const ins = db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)');
  const result = ins.run(req.params.id, req.userId, body.trim());
  const msg = db.prepare(`
    SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
           u.email AS sender_email, u.display_name AS sender_name
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(result.lastInsertRowid);

  const participants = db.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?').all(req.params.id);
  const convRow = db.prepare('SELECT name FROM conversations WHERE id = ?').get(req.params.id);
  const senderName = msg.sender_name || msg.sender_email;

  for (const p of participants) {
    if (p.user_id === req.userId) continue;
    const notifText = convRow.name
      ? `${senderName} replied in "${convRow.name}"`
      : `${senderName} sent a message`;
    db.prepare(`
      INSERT INTO notifications (user_id, conversation_id, message_id, type, text) VALUES (?, ?, ?, 'new_message', ?)
    `).run(p.user_id, req.params.id, msg.id, notifText);
    io.to(`user:${p.user_id}`).emit('notification', {
      id: db.prepare('SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(p.user_id).id,
      conversationId: parseInt(req.params.id, 10),
      messageId: msg.id,
      type: 'new_message',
      text: notifText,
      read: false,
      created_at: msg.created_at,
    });
  }

  io.to(`conv:${req.params.id}`).emit('message', msg);
  res.status(201).json(msg);
});

// ----- Notifications -----
app.get('/api/notifications', authMiddleware, (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const unreadOnly = req.query.unread === 'true';
  let rows;
  if (unreadOnly) {
    rows = db.prepare(`
      SELECT n.id, n.user_id, n.conversation_id, n.message_id, n.type, n.text, n.read, n.created_at
      FROM notifications n WHERE n.user_id = ? AND n.read = 0 ORDER BY n.created_at DESC LIMIT ?
    `).all(req.userId, limit);
  } else {
    rows = db.prepare(`
      SELECT n.id, n.user_id, n.conversation_id, n.message_id, n.type, n.text, n.read, n.created_at
      FROM notifications n WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ?
    `).all(req.userId, limit);
  }
  res.json(rows);
});

app.patch('/api/notifications/:id/read', authMiddleware, (req, res) => {
  const db = getDb();
  const r = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

app.patch('/api/notifications/read-all', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
  res.json({ ok: true });
});

// ----- Socket.io -----
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(new Error('Unauthorized'));
  socket.userId = payload.userId;
  next();
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.on('join_conversation', (conversationId) => {
    const db = getDb();
    const ok = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(conversationId, socket.userId);
    if (ok) socket.join(`conv:${conversationId}`);
  });
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conv:${conversationId}`);
  });
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
