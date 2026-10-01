// GET    /api/votes?session=1                 -> all votes in a session
// POST   /api/votes { session, roll }         -> check & add (atomic)
// DELETE /api/votes?session=1&roll=BSCS24009  -> remove a mistaken entry
const { sql, ensureSchema } = require('../lib/db');
const { send, readBody, query, wrap, normalizeRoll, isValidRoll } = require('../lib/http');
const { requireUser } = require('../lib/auth');

async function ownSession(user, id) {
  const [s] = await sql`SELECT id, name FROM vote_sessions WHERE id = ${Number(id) || 0} AND user_id = ${user.id}`;
  if (!s) throw Object.assign(new Error('Session not found'), { status: 404 });
  return s;
}

module.exports = wrap(async (req, res) => {
  await ensureSchema();
  const user = requireUser(req);

  if (req.method === 'GET') {
    const s = await ownSession(user, query(req).session);
    const rows = await sql`
      SELECT roll_no, voted_at, source FROM votes
      WHERE session_id = ${s.id} ORDER BY voted_at ASC, id ASC`;
    return send(res, 200, { session: s, votes: rows });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const s = await ownSession(user, body.session);
    const roll = normalizeRoll(body.roll);
    if (!isValidRoll(roll)) {
      return send(res, 400, { status: 'invalid', roll, error: `"${roll}" is not a valid roll number (e.g. BSCS24009)` });
    }
    // INSERT … ON CONFLICT is race-safe when several people type at once.
    const [added] = await sql`
      INSERT INTO votes (session_id, roll_no, source) VALUES (${s.id}, ${roll}, 'manual')
      ON CONFLICT (session_id, roll_no) DO NOTHING
      RETURNING roll_no, voted_at, source`;
    if (added) return send(res, 200, { status: 'added', vote: added });
    const [existing] = await sql`
      SELECT roll_no, voted_at, source FROM votes WHERE session_id = ${s.id} AND roll_no = ${roll}`;
    return send(res, 200, { status: 'exists', vote: existing });
  }

  if (req.method === 'DELETE') {
    const q = query(req);
    const s = await ownSession(user, q.session);
    const r = await sql`DELETE FROM votes WHERE session_id = ${s.id} AND roll_no = ${normalizeRoll(q.roll)}`;
    return send(res, r.count ? 200 : 404, r.count ? { ok: true } : { error: 'Entry not found' });
  }

  send(res, 405, { error: 'Method not allowed' });
});

module.exports.ownSession = ownSession;
