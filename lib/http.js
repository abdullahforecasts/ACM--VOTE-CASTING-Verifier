// Tiny helpers so handlers work on Vercel and in the local dev server alike.
const crypto = require('crypto');

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString() || '{}'); } catch { return {}; } }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 4 * 1024 * 1024) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// Roll numbers: letters + 2-digit batch year + 3-digit serial, e.g. BSCS24009, BSEDS25009, MSCS24009.
const ROLL_RE = /^[A-Z]{2,6}\d{5}$/;
function normalizeRoll(raw) {
  return String(raw || '').toUpperCase().replace(/[\s\-_/.]/g, '');
}
function isValidRoll(r) { return ROLL_RE.test(r); }

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (!e.status) console.error(e);
      send(res, e.status || 500, { error: e.status ? e.message : 'Server error: ' + e.message });
    }
  };
}

const randomId = () => crypto.randomBytes(16).toString('hex');

module.exports = { send, readBody, query, cookies, normalizeRoll, isValidRoll, wrap, randomId };
