import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'app.db');

let db;

function createDbWrapper(dbInstance) {
  function save() {
    try {
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      const data = dbInstance.export();
      writeFileSync(dbPath, Buffer.from(data));
    } catch (e) {
      console.error('Failed to save DB:', e.message);
    }
  }

  return {
    prepare(sql) {
      return {
        run(...params) {
          if (params.length) {
            dbInstance.run(sql, params);
          } else {
            dbInstance.run(sql);
          }
          save();
          const idResult = dbInstance.exec('SELECT last_insert_rowid() AS id');
          const changesResult = dbInstance.exec('SELECT changes() AS c');
          const lastInsertRowid = idResult.length && idResult[0].values[0] ? idResult[0].values[0][0] : 0;
          const changes = changesResult.length && changesResult[0].values[0] ? changesResult[0].values[0][0] : 0;
          return { lastInsertRowid, changes };
        },
        get(...params) {
          const stmt = dbInstance.prepare(sql);
          stmt.bind(params);
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        all(...params) {
          const stmt = dbInstance.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    exec(sql) {
      dbInstance.run(sql);
      save();
    },
  };
}

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

  CREATE TRIGGER IF NOT EXISTS messages_after_insert
  AFTER INSERT ON messages
  BEGIN
    UPDATE conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id;
  END;
`;


export async function initDb() {
  const SQL = await initSqlJs();
  if (existsSync(dbPath)) {
    const buf = readFileSync(dbPath);
    const dbInstance = new SQL.Database(buf);
    db = createDbWrapper(dbInstance);
  } else {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const dbInstance = new SQL.Database();
    dbInstance.run(schema);
    db = createDbWrapper(dbInstance);
    const data = dbInstance.export();
    writeFileSync(dbPath, Buffer.from(data));
  }
  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}
