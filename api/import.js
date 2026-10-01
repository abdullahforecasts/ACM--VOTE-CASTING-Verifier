// POST /api/import { session, rows: [{ roll, voted_at? }], defaultTime? }
// Bulk-adds previously cast votes. Existing roll numbers are skipped, never overwritten.
const { sql, ensureSchema } = require('../lib/db');
const { send, readBody, wrap, normalizeRoll, isValidRoll } = require('../lib/http');
const { requireUser } = require('../lib/auth');

const MAX_ROWS = 5000;

module.exports = wrap(async (req, res) => {
  await ensureSchema();
  const user = requireUser(req);
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const body = await readBody(req);
  const [s] = await sql`SELECT id FROM vote_sessions WHERE id = ${Number(body.session) || 0} AND user_id = ${user.id}`;
  if (!s) return send(res, 404, { error: 'Session not found' });

  const input = Array.isArray(body.rows) ? body.rows : [];
  if (!input.length) return send(res, 400, { error: 'No rows to import' });
  if (input.length > MAX_ROWS) return send(res, 400, { error: `Max ${MAX_ROWS} rows per import` });

  const fallback = body.defaultTime && !isNaN(Date.parse(body.defaultTime)) ? new Date(body.defaultTime) : new Date();

  const invalid = [];
  const inFile = new Set();
  const dupInFile = [];
  const rows = [];
  for (const r of input) {
    const roll = normalizeRoll(r && r.roll);
    if (!roll) continue;
    if (!isValidRoll(roll)) { invalid.push(String(r.roll)); continue; }
    if (inFile.has(roll)) { dupInFile.push(roll); continue; }
    inFile.add(roll);
    const t = r.voted_at && !isNaN(Date.parse(r.voted_at)) ? new Date(r.voted_at) : fallback;
    rows.push({ session_id: s.id, roll_no: roll, voted_at: t, source: 'import' });
  }

  let addedRolls = [];
  if (rows.length) {
    const inserted = await sql`
      INSERT INTO votes ${sql(rows, 'session_id', 'roll_no', 'voted_at', 'source')}
      ON CONFLICT (session_id, roll_no) DO NOTHING
      RETURNING roll_no`;
    addedRolls = inserted.map((x) => x.roll_no);
  }
  const addedSet = new Set(addedRolls);
  const alreadyThere = rows.filter((r) => !addedSet.has(r.roll_no)).map((r) => r.roll_no);

  send(res, 200, {
    added: addedRolls.length,
    skippedExisting: alreadyThere,
    duplicatesInFile: dupInFile,
    invalid,
  });
});
