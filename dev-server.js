// Local runner: `DATABASE_URL=postgres://... node dev-server.js` -> http://localhost:3000
// (On Vercel this file is not used; /api/*.js become serverless functions automatically.)
const http = require('http');
const fs = require('fs');
const path = require('path');

const routes = {};
for (const f of fs.readdirSync(path.join(__dirname, 'api'))) {
  if (f.endsWith('.js')) routes['/api/' + f.slice(0, -3)] = require('./api/' + f);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (routes[p]) return routes[p](req, res);
  const file = path.join(__dirname, 'public', p === '/' ? 'index.html' : path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(process.env.PORT || 3000, () => console.log('VoteCheck on http://localhost:' + (process.env.PORT || 3000)));
