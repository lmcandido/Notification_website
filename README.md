# Notifications & Chat

Local React + Node/Express app with email/password auth, group conversations, and a distinct notification feed. See [NOTIFICATIONS_CHAT_SPEC.md](NOTIFICATIONS_CHAT_SPEC.md) for product context.

## Run locally

### 1. Backend (Node/Express + SQLite)

```bash
cd server
npm install
npm run dev
```

Server runs at **http://localhost:3000**. SQLite DB (via sql.js, no native build) is created at `server/data/app.db` on first run.

### 2. Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

App runs at **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to the backend.

## Usage

1. **Register** two (or more) users (e.g. `a@test.com` / `b@test.com`).
2. **Sign in** as one user.
3. Click **New** to create a conversation; optionally add a group name and select other users.
4. Open a conversation to send messages. Other participants get a **notification** in the feed and see the message in real time if the chat is open.
5. Use **Load older messages** in a conversation to paginate history.

## Stack

- **Frontend**: React 18, Vite, React Router, Socket.io client
- **Backend**: Express, SQLite (sql.js), JWT auth, Socket.io
- **Auth**: Email/password (bcrypt + JWT)
