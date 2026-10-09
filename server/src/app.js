import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';

const COOKIE = 'cms_shipping_session';
const hash = (value) => createHash('sha256').update(value).digest();
async function readJson(req, maxBytes = 65536) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new HttpError(413, 'BODY_TOO_LARGE', `Dữ liệu vượt ${maxBytes / 1024} KB`);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'INVALID_JSON', 'JSON không hợp lệ'); }
}
export function createApp({ shipping, ghnGateway, adminPassword, frontendOrigin, secureCookies = false }) {
  if (typeof adminPassword !== 'string' || adminPassword.length < 16) throw new Error('ADMIN_PASSWORD phải có ít nhất 16 ký tự');
  const expected = hash(adminPassword);
  const sessions = new Map();
  const attempts = new Map();
  const sessionCookie = (value, seconds) => `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secureCookies ? '; Secure' : ''}`;
  const server = createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.headers.origin && req.headers.origin !== frontendOrigin) throw new HttpError(403, 'ORIGIN_DENIED', 'Origin không được phép');
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/health') return send(200, { ok: true });
      if (req.method === 'POST' && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
        throw new HttpError(415, 'JSON_REQUIRED', 'Cần Content-Type: application/json');
      }
      if (req.method === 'POST' && path === '/api/auth/login') {
        const key = req.socket.remoteAddress;
        const now = Date.now();
        const attempt = attempts.get(key);
        if (attempt && now < attempt.until && attempt.count >= 10) throw new HttpError(429, 'RATE_LIMITED', 'Thử lại sau 15 phút');
        const body = await readJson(req);
        const password = typeof body.password === 'string' ? body.password : '';
        if (!timingSafeEqual(hash(password), expected)) {
          attempts.set(key, { count: attempt && now < attempt.until ? attempt.count + 1 : 1, until: now + 900000 });
          throw new HttpError(401, 'INVALID_PASSWORD', 'Mật khẩu không đúng');
        }
        attempts.delete(key);
        for (const [id, expiry] of sessions) if (expiry <= now) sessions.delete(id);
        // A small internal CMS; cap active sessions to bound memory.
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, now + 8 * 3600000);
        res.setHeader('Set-Cookie', sessionCookie(token, 8 * 3600));
        return send(200, { ok: true });
      }
      const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      if (!token || (sessions.get(token) || 0) <= Date.now()) throw new HttpError(401, 'UNAUTHORIZED', 'Cần đăng nhập quản trị');
      if (req.method === 'POST' && path === '/api/auth/logout') {
        sessions.delete(token);
        res.setHeader('Set-Cookie', sessionCookie('', 0));
        return send(200, { ok: true });
      }
      if (req.method === 'POST' && /^\/api\/shipments\/[A-Za-z0-9_-]{8,50}\/reconcile$/.test(path)) {
        return send(200, await shipping.reconcile(path.split('/')[3]));
      }
      if (req.method === 'POST' && path === '/api/ghn/orders/create') {
        return send(200, await shipping.createRaw(await readJson(req)));
      }
      if (path.startsWith('/api/ghn/') && ghnGateway) {
        const input = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readJson(req, path === '/api/ghn/orders/print' ? 1048576 : 65536);
        return send(200, await ghnGateway.handle(req.method, path, input));
      }
      if (req.method === 'POST' && path === '/api/shipments') return send(200, await shipping.create(await readJson(req)));
      if (req.method === 'GET' && /^\/api\/shipments\/[A-Za-z0-9_-]{8,100}$/.test(path)) {
        return send(200, shipping.get(path.split('/').pop()));
      }
      throw new HttpError(404, 'NOT_FOUND', 'API không tồn tại');
    } catch (error) {
      const known = error instanceof HttpError;
      send(known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Lỗi máy chủ', upstreamCode: known ? error.upstreamCode || null : null } });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return server;
}
