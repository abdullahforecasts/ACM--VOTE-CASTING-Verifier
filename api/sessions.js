// GET    /api/sessions            -> list my sessions (with vote counts)
// POST   /api/sessions { name }   -> create
// PATCH  /api/sessions { id, name } -> rename
// DELETE /api/sessions?id=1       -> delete (and its votes)
const { sql, ensureSchema } = require('../lib/db');
const { send, readBody, query, wrap } = require('../lib/http');
const { requireUser } = require('../lib/auth');

module.exports = wrap(async (req, res) => {
  await ensureSchema();
  const user = requireUser(req);

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT s.id, s.name, s.created_at,
             COUNT(v.id)::int AS votes, MAX(v.voted_at) AS last_vote
      FROM vote_sessions s LEFT JOIN votes v ON v.session_id = s.id
      WHERE s.user_id = ${user.id}
      GROUP BY s.id ORDER BY s.created_at DESC`;
    return send(res, 200, { sessions: rows });
  }

  if (req.method === 'POST') {
    const { name } = await readBody(req);
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean) return send(res, 400, { error: 'Session name is required' });
    const [row] = await sql`
      INSERT INTO vote_sessions (user_id, name) VALUES (${user.id}, ${clean})
      RETURNING id, name, created_at`;
    return send(res, 200, { session: { ...row, votes: 0 } });
  }

  if (req.method === 'PATCH') {
    const { id, name } = await readBody(req);
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean) return send(res, 400, { error: 'Session name is required' });
    const [row] = await sql`
      UPDATE vote_sessions SET name = ${clean}
      WHERE id = ${Number(id)} AND user_id = ${user.id} RETURNING id, name`;
    return send(res, row ? 200 : 404, row ? { session: row } : { error: 'Session not found' });
  }

  if (req.method === 'DELETE') {
    const id = Number(query(req).id);
    const r = await sql`DELETE FROM vote_sessions WHERE id = ${id} AND user_id = ${user.id}`;
    return send(res, r.count ? 200 : 404, r.count ? { ok: true } : { error: 'Session not found' });
  }

  send(res, 405, { error: 'Method not allowed' });
});
