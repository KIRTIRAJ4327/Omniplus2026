// Local stand-in for Vercel: serves /public with clean URLs and runs /api/*.js functions.
// Usage: DATABASE_URL=... HOST_PIN=... npm run dev
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const handlers = new Map();

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
      const file = path.join(root, 'api', name + '.js');
      if (!handlers.has(name)) handlers.set(name, (await import(pathToFileURL(file).href)).default);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : raw;
      req.query = Object.fromEntries(url.searchParams);
      return await handlers.get(name)(req, res);
    }
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!path.extname(p)) p += '.html';
    const file = path.join(root, 'public', path.normalize(p));
    if (!file.startsWith(path.join(root, 'public'))) throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND') { res.writeHead(404); res.end('Not found'); return; }
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end('Server error'); }
  }
}).listen(PORT, () => console.log(`Pulse Check dev server on http://localhost:${PORT}  (host screen: /host)`));
