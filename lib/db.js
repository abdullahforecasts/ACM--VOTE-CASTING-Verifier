// Postgres connection (Neon on Vercel, any Postgres locally).
const postgres = require('postgres');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const isLocal = /localhost|127\.0\.0\.1/.test(url);

// One small connection per serverless instance; prepare:false keeps it pooler-friendly.
const sql = global.__sql || postgres(url, {
  max: 1,
  prepare: false,
  ssl: isLocal ? false : 'require',
  idle_timeout: 20,
  onnotice: () => {},
});
global.__sql = sql;

let ready = global.__schemaReady || null;

// Tables are created automatically on first request — no migration step needed.
function ensureSchema() {
  if (!ready) {
    ready = sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(424242)`;
      await tx`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        pass_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await tx`CREATE TABLE IF NOT EXISTS vote_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await tx`CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        session_id INT NOT NULL REFERENCES vote_sessions(id) ON DELETE CASCADE,
        roll_no TEXT NOT NULL,
        voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        source TEXT NOT NULL DEFAULT 'manual',
        UNIQUE (session_id, roll_no)
      )`;
    }).catch((e) => { ready = null; global.__schemaReady = null; throw e; });
    global.__schemaReady = ready;
  }
  return ready;
}

module.exports = { sql, ensureSchema };
