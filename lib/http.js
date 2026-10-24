import { ensureSchema } from './db.js';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

export function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' && b) { try { return JSON.parse(b); } catch { return {}; } }
  if (Buffer.isBuffer(b)) { try { return JSON.parse(b.toString('utf8')); } catch { return {}; } }
  return {};
}

export function query(req) {
  return new URL(req.url, 'http://local').searchParams;
}

// Wraps a route: ensures the schema exists, maps errors to clean JSON responses.
export function route(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed');
      await ensureSchema();
      const out = await fn(req, res);
      if (out !== undefined && !res.writableEnded) send(res, 200, out);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      if (!res.writableEnded) {
        send(res, status, { error: status === 500 ? 'Something went wrong on the server. Check the function logs.' : e.message, ...(e.extra || {}) });
      }
    }
  };
}

export function requireHost(req) {
  const pin = String(req.headers['x-host-pin'] || '');
  const expected = String(process.env.HOST_PIN || '');
  if (!expected) throw new HttpError(500, 'HOST_PIN is not set on the server.');
  if (pin.length !== expected.length || !timingSafe(pin, expected)) throw new HttpError(401, 'Wrong host PIN.');
}

function timingSafe(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
