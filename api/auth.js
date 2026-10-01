// POST /api/auth  { action: 'signup' | 'login' | 'logout', username, password }
// GET  /api/auth  -> current user
const { sql, ensureSchema } = require('../lib/db');
const { send, readBody, wrap } = require('../lib/http');
const { hashPassword, verifyPassword, makeToken, authCookie, currentUser } = require('../lib/auth');

module.exports = wrap(async (req, res) => {
  await ensureSchema();

  if (req.method === 'GET') {
    return send(res, 200, { user: currentUser(req) });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const { action, username: rawName, password } = await readBody(req);

  if (action === 'logout') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': authCookie(req, '', 0) });
  }

  const username = String(rawName || '').trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return send(res, 400, { error: 'Username must be 3–32 characters: letters, numbers, _ . -' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return send(res, 400, { error: 'Password must be at least 6 characters' });
  }

  if (action === 'signup') {
    const [user] = await sql`
      INSERT INTO users (username, pass_hash) VALUES (${username}, ${hashPassword(password)})
      ON CONFLICT (username) DO NOTHING RETURNING id, username`;
    if (!user) return send(res, 409, { error: 'That username is taken' });
    return send(res, 200, { user }, { 'Set-Cookie': authCookie(req, makeToken(user)) });
  }

  if (action === 'login') {
    const [row] = await sql`SELECT id, username, pass_hash FROM users WHERE username = ${username}`;
    if (!row || !verifyPassword(password, row.pass_hash)) {
      return send(res, 401, { error: 'Wrong username or password' });
    }
    const user = { id: row.id, username: row.username };
    return send(res, 200, { user }, { 'Set-Cookie': authCookie(req, makeToken(user)) });
  }

  send(res, 400, { error: 'Unknown action' });
});
