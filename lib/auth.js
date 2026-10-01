// Password hashing (scrypt) and signed session cookies (HMAC) — no external deps.
const crypto = require('crypto');
const { cookies } = require('./http');

const SECRET = process.env.AUTH_SECRET
  || crypto.createHash('sha256').update('vote-roll:' + (process.env.DATABASE_URL || process.env.POSTGRES_URL || '')).digest('hex');

const COOKIE = 'vr_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, u: user.username, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now() / 1000) return null;
    return { id: data.uid, username: data.u };
  } catch { return null; }
}

function authCookie(req, token, maxAge = MAX_AGE) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function currentUser(req) {
  return readToken(cookies(req)[COOKIE]);
}

function requireUser(req) {
  const u = currentUser(req);
  if (!u) throw Object.assign(new Error('Please log in'), { status: 401 });
  return u;
}

module.exports = { hashPassword, verifyPassword, makeToken, authCookie, currentUser, requireUser };
