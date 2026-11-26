/* Fastex Outreach Desk — shared storage API (Cloudflare Pages Function + D1) with personal logins.
   Sign-in uses an HttpOnly session cookie. Every change must also send the header "x-od: 1"
   (a cross-site page cannot add it), and is checked against the user's role and client access.

   Routes:
     GET    /api/status                       → is storage set up? does it still need its first admin?
     POST   /api/auth/setup                   → create the first admin (needs the WORKSPACE_KEY setup code; only while there are no users)
     POST   /api/auth/login                   → { email, password } → session cookie
     POST   /api/auth/logout                  → ends this session
     GET    /api/auth/me                      → the signed-in user
     POST   /api/auth/password                → { current, next } change your own password
     GET    /api/users                        → admins: list users
     POST   /api/users                        → admins: create a user
     PUT    /api/users/<id>                   → admins: edit, reset password, deactivate
     DELETE /api/users/<id>                   → admins: delete
     GET    /api/sync?since=<ms>              → documents changed after <ms> that this user may see
     PUT    /api/doc?path=<path>              → create or replace one document
     DELETE /api/doc?path=<path>              → delete one document
     POST   /api/batch                        → { puts: [{path, data}], dels: [path] } up to 100 at once

   Roles: admin (everything, users, settings) · manager (clients, sequences, deleting prospects)
          · member (work prospects: add, edit, log activity) · viewer (read only).
   A user's "clients" is null for all clients, or a list of client ids they may see and change.

   Bindings (Cloudflare): DB = D1 database; WORKSPACE_KEY = one-time setup code for the first admin;
   ADMIN_WHATSAPP (optional) = number shown on the login screen for forgotten passwords. */

const PATH_RE = /^(meta|clients|sequences)\/[A-Za-z0-9_\-.~:@+]{1,200}$|^clients\/[A-Za-z0-9_\-.~:@+]{1,200}\/prospects\/[A-Za-z0-9_\-.~:@+]{1,200}$/;
const MAX_DOC = 262144;
const PAGE = 2000;
const SESSION_DAYS = 30;
const COOKIE = 'od_session';
const ROLES = ['admin', 'manager', 'member', 'viewer'];
const RANK = { viewer: 0, member: 1, manager: 2, admin: 3 };
const PBKDF2_ITER = 100000;
const MAX_FAILS = 8, MAX_FAILS_IP = 40, FAIL_WINDOW = 15 * 60 * 1000;  // per email / per internet connection (offices share one)
let ready = false;

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, extraHeaders || {}),
  });
}
async function ensureTables(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data TEXT, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS docs_updated ON docs (updated_at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, clients TEXT, member_id TEXT, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS login_fails (k TEXT PRIMARY KEY, n INTEGER NOT NULL, first_at INTEGER NOT NULL)'),
  ]);
  ready = true;
}

/* ---------- crypto helpers ---------- */
const enc = new TextEncoder();
const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
async function sameText(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}
async function hashPassword(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16))) : randomBytes(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}

/* ---------- users and sessions ---------- */
const cleanEmail = e => String(e || '').trim().toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const validPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 200;
function parseClients(v) { if (v == null || v === '') return null; try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : null; } catch (e) { return null; } }
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, clients: parseClients(u.clients), memberId: u.member_id || null,
    active: !!u.active, mustChange: !!u.must_change, createdAt: u.created_at, lastLogin: u.last_login || null };
}
function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function sessionCookie(token, maxAge) {
  return COOKIE + '=' + (token || '') + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + (maxAge || 0);
}
async function startSession(db, userId) {
  const token = b64url(randomBytes(32));
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(await sha256(token), userId, now, now + SESSION_DAYS * 86400000),
    db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now),
    db.prepare('UPDATE users SET last_login = ?1 WHERE id = ?2').bind(now, userId),
  ]);
  return sessionCookie(token, SESSION_DAYS * 86400);
}
async function currentUser(db, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await db.prepare('SELECT u.*, s.id AS sid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1 AND s.expires_at > ?2').bind(await sha256(token), Date.now()).first();
  if (!row || !row.active) return null;
  return row;
}
async function tooManyFails(db, keys) {
  const now = Date.now();
  for (const k of keys) {
    const r = await db.prepare('SELECT n, first_at FROM login_fails WHERE k = ?1').bind(k).first();
    if (r && now - r.first_at < FAIL_WINDOW && r.n >= (k.startsWith('ip:') ? MAX_FAILS_IP : MAX_FAILS)) return true;
  }
  return false;
}
async function noteFail(db, keys) {
  const now = Date.now();
  await db.batch(keys.map(k => db.prepare('INSERT INTO login_fails (k, n, first_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN ?2 - first_at > ?3 THEN 1 ELSE n + 1 END, first_at = CASE WHEN ?2 - first_at > ?3 THEN ?2 ELSE first_at END').bind(k, now, FAIL_WINDOW)));
}
async function countAdmins(db, exceptId) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?1").bind(exceptId || '').first();
  return r ? r.n : 0;
}

/* ---------- permissions ---------- */
function clientOfPath(path) { const m = /^clients\/([^/]+)/.exec(path); return m ? m[1] : null; }
function hasClient(u, cid) { const list = parseClients(u.clients); return u.role === 'admin' || list === null || list.indexOf(cid) !== -1; }
function allClients(u) { return u.role === 'admin' || parseClients(u.clients) === null; }
function canRead(u, path, data) {
  if (allClients(u)) return true;
  const cid = clientOfPath(path);
  if (cid) return hasClient(u, cid);
  if (path.startsWith('sequences/')) return !data || !data.clientId || hasClient(u, data.clientId);
  return true;
}
/* op: 'put' | 'del'; oldData / newData for sequences (their client lives inside the document). */
function canWrite(u, path, op, oldData, newData) {
  const rank = RANK[u.role] || 0;
  if (path === 'meta/settings') return u.role === 'admin';
  if (/^clients\/[^/]+\/prospects\//.test(path)) return hasClient(u, clientOfPath(path)) && (op === 'put' ? rank >= RANK.member : rank >= RANK.manager);
  if (/^clients\/[^/]+$/.test(path)) return rank >= RANK.manager && (oldData ? hasClient(u, clientOfPath(path)) : allClients(u));
  if (path.startsWith('sequences/')) {
    if (rank < RANK.manager) return false;
    const ok = d => !d || (d.clientId ? hasClient(u, d.clientId) : allClients(u));
    return ok(oldData) && ok(newData);
  }
  return false;
}
async function loadDocs(db, paths) {
  const out = {};
  for (let i = 0; i < paths.length; i += 50) {
    const part = paths.slice(i, i + 50);
    const res = await db.prepare('SELECT path, data FROM docs WHERE deleted = 0 AND path IN (' + part.map((_, j) => '?' + (j + 1)).join(',') + ')').bind(...part).all();
    for (const r of res.results || []) out[r.path] = JSON.parse(r.data);
  }
  return out;
}

/* ---------- documents ---------- */
function checkDoc(path, data) {
  if (!PATH_RE.test(path || '')) return 'bad_path';
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'bad_json';
  if (JSON.stringify(data).length > MAX_DOC) return 'too_large';
  return null;
}
function putStmt(db, path, text, now) {
  return db.prepare('INSERT INTO docs (path, data, updated_at, deleted) VALUES (?1, ?2, ?3, 0) ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(path, text, now);
}
function delStmt(db, path, now) {
  return db.prepare('INSERT INTO docs (path, data, updated_at, deleted) VALUES (?1, NULL, ?2, 1) ON CONFLICT(path) DO UPDATE SET data = NULL, updated_at = excluded.updated_at, deleted = 1').bind(path, now);
}
async function readBody(request) { try { return await request.json(); } catch (e) { return null; } }

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = Array.isArray(params.path) ? params.path : [String(params.path || '')];
  const route = parts.join('/');
  const method = request.method;
  const db = env.DB;
  const adminWhatsapp = String(env.ADMIN_WHATSAPP || '').replace(/[^0-9]/g, '') || null;
  if (!db) return route === 'status' ? json({ app: 'fastex-outreach-desk', configured: false, adminWhatsapp }) : json({ error: 'not_configured' }, 503);
  await ensureTables(db);

  if (route === 'status' && method === 'GET') {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
    return json({ app: 'fastex-outreach-desk', configured: true, auth: 'users', needsSetup: !r || r.n === 0, adminWhatsapp });
  }
  // Every change must carry the custom header: other sites cannot add it to a request.
  if (method !== 'GET' && request.headers.get('x-od') !== '1') return json({ error: 'bad_request' }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  /* ----- first admin ----- */
  if (route === 'auth/setup' && method === 'POST') {
    const r = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (r && r.n > 0) return json({ error: 'already_set_up' }, 409);
    const b = await readBody(request) || {};
    if (await tooManyFails(db, ['setup:' + ip])) return json({ error: 'too_many_tries' }, 429);
    if (!env.WORKSPACE_KEY || !b.code || !(await sameText(b.code, env.WORKSPACE_KEY))) { await noteFail(db, ['setup:' + ip]); return json({ error: 'bad_code' }, 401); }
    const email = cleanEmail(b.email), name = String(b.name || '').trim().slice(0, 80);
    if (!name || !validEmail(email)) return json({ error: 'bad_details' }, 400);
    if (!validPassword(b.password)) return json({ error: 'weak_password' }, 400);
    const { hash, salt } = await hashPassword(b.password);
    const id = 'u_' + b64url(randomBytes(9)), now = Date.now();
    await db.prepare('INSERT INTO users (id, email, name, role, clients, member_id, pass_hash, pass_salt, active, must_change, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, 1, 0, ?8, ?8)')
      .bind(id, email, name, 'admin', b.memberId ? String(b.memberId).slice(0, 80) : null, hash, salt, now).run();
    const cookie = await startSession(db, id);
    return json({ ok: true, user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first()) }, 200, { 'set-cookie': cookie });
  }

  /* ----- sign in / out ----- */
  if (route === 'auth/login' && method === 'POST') {
    const b = await readBody(request) || {};
    const email = cleanEmail(b.email);
    const keys = ['ip:' + ip, 'em:' + email];
    if (await tooManyFails(db, keys)) return json({ error: 'too_many_tries' }, 429);
    const u = email ? await db.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first() : null;
    const check = await hashPassword(String(b.password || ''), u ? u.pass_salt : null);
    if (!u || !(await sameText(check.hash, u.pass_hash))) { await noteFail(db, keys); return json({ error: 'bad_login' }, 401); }
    if (!u.active) return json({ error: 'inactive' }, 403);
    await db.prepare('DELETE FROM login_fails WHERE k = ?1').bind('em:' + email).run();
    const cookie = await startSession(db, u.id);
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': cookie });
  }
  if (route === 'auth/logout' && method === 'POST') {
    const token = readCookie(request, COOKIE);
    if (token) await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  /* ----- everything below needs a signed-in user ----- */
  const me = await currentUser(db, request);
  if (!me) return json({ error: 'signed_out' }, 401, { 'set-cookie': sessionCookie('', 0) });

  if (route === 'auth/me' && method === 'GET') return json({ user: publicUser(me) });
  if (route === 'auth/password' && method === 'POST') {
    const b = await readBody(request) || {};
    if (await tooManyFails(db, ['pw:' + me.id])) return json({ error: 'too_many_tries' }, 429);
    const check = await hashPassword(String(b.current || ''), me.pass_salt);
    if (!(await sameText(check.hash, me.pass_hash))) { await noteFail(db, ['pw:' + me.id]); return json({ error: 'bad_password' }, 401); }
    if (!validPassword(b.next)) return json({ error: 'weak_password' }, 400);
    const { hash, salt } = await hashPassword(b.next);
    await db.batch([
      db.prepare('UPDATE users SET pass_hash = ?1, pass_salt = ?2, must_change = 0, updated_at = ?3 WHERE id = ?4').bind(hash, salt, Date.now(), me.id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND id != ?2').bind(me.id, me.sid),
    ]);
    return json({ ok: true });
  }

  /* ----- user management (admins) ----- */
  if (parts[0] === 'users') {
    if (me.role !== 'admin') return json({ error: 'forbidden' }, 403);
    const id = parts[1] || '';
    if (!id && method === 'GET') {
      const res = await db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all();
      return json({ users: (res.results || []).map(publicUser) });
    }
    const b = method === 'DELETE' ? {} : (await readBody(request) || {});
    const role = b.role !== undefined ? String(b.role) : undefined;
    if (role !== undefined && ROLES.indexOf(role) === -1) return json({ error: 'bad_role' }, 400);
    const clients = b.clients === undefined ? undefined : (b.clients === null ? null : (Array.isArray(b.clients) ? JSON.stringify(b.clients.map(String).slice(0, 500)) : undefined));
    if (!id && method === 'POST') {
      const email = cleanEmail(b.email), name = String(b.name || '').trim().slice(0, 80);
      if (!name || !validEmail(email)) return json({ error: 'bad_details' }, 400);
      if (!validPassword(b.password)) return json({ error: 'weak_password' }, 400);
      if (await db.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()) return json({ error: 'email_taken' }, 409);
      const { hash, salt } = await hashPassword(b.password);
      const nid = 'u_' + b64url(randomBytes(9)), now = Date.now();
      await db.prepare('INSERT INTO users (id, email, name, role, clients, member_id, pass_hash, pass_salt, active, must_change, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?10)')
        .bind(nid, email, name, role || 'member', clients === undefined ? null : clients, b.memberId ? String(b.memberId).slice(0, 80) : null, hash, salt, b.mustChange === false ? 0 : 1, now).run();
      return json({ ok: true, user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?1').bind(nid).first()) });
    }
    const u = id ? await db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first() : null;
    if (!u) return json({ error: 'not_found' }, 404);
    const losesAdmin = u.role === 'admin' && u.active && ((role !== undefined && role !== 'admin') || b.active === false || method === 'DELETE');
    if (losesAdmin && (await countAdmins(db, u.id)) === 0) return json({ error: 'last_admin' }, 409);
    if (method === 'DELETE') {
      if (u.id === me.id) return json({ error: 'self' }, 409);
      await db.batch([db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(u.id), db.prepare('DELETE FROM users WHERE id = ?1').bind(u.id)]);
      return json({ ok: true });
    }
    if (method === 'PUT') {
      const sets = [], vals = [];
      const add = (col, v) => { sets.push(col + ' = ?' + (vals.length + 1)); vals.push(v); };
      if (b.name !== undefined) { const n = String(b.name).trim().slice(0, 80); if (!n) return json({ error: 'bad_details' }, 400); add('name', n); }
      if (b.email !== undefined) {
        const e = cleanEmail(b.email);
        if (!validEmail(e)) return json({ error: 'bad_details' }, 400);
        const other = await db.prepare('SELECT id FROM users WHERE email = ?1 AND id != ?2').bind(e, u.id).first();
        if (other) return json({ error: 'email_taken' }, 409);
        add('email', e);
      }
      if (role !== undefined) add('role', role);
      if (clients !== undefined) add('clients', clients);
      if (b.memberId !== undefined) add('member_id', b.memberId ? String(b.memberId).slice(0, 80) : null);
      if (b.active !== undefined) { if (u.id === me.id && !b.active) return json({ error: 'self' }, 409); add('active', b.active ? 1 : 0); }
      let endSessions = b.active === false || (role !== undefined && role !== u.role);
      if (b.password !== undefined) {
        if (!validPassword(b.password)) return json({ error: 'weak_password' }, 400);
        const { hash, salt } = await hashPassword(b.password);
        add('pass_hash', hash); add('pass_salt', salt); add('must_change', u.id === me.id ? 0 : 1);
        endSessions = endSessions || u.id !== me.id;
      }
      if (!sets.length) return json({ ok: true, user: publicUser(u) });
      add('updated_at', Date.now());
      const stmts = [db.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?' + (vals.length + 1)).bind(...vals, u.id)];
      if (endSessions) stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(u.id));
      await db.batch(stmts);
      return json({ ok: true, user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?1').bind(u.id).first()) });
    }
    return json({ error: 'not_found' }, 404);
  }

  /* ----- documents ----- */
  const url = new URL(request.url);
  if (route === 'sync' && method === 'GET') {
    const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
    const res = await db.prepare('SELECT path, data, updated_at, deleted FROM docs WHERE updated_at > ?1 ORDER BY updated_at LIMIT ' + PAGE).bind(since).all();
    const rows = res.results || [];
    const docs = [];
    for (const r of rows) {
      const data = r.deleted ? null : JSON.parse(r.data);
      if (!canRead(me, r.path, data)) continue;
      docs.push({ path: r.path, updated: r.updated_at, deleted: !!r.deleted, data });
    }
    return json({ now: Date.now(), more: rows.length === PAGE, top: rows.length ? rows[rows.length - 1].updated_at : since, docs });
  }
  if (me.role === 'viewer') return json({ error: 'forbidden' }, 403);

  if (route === 'doc') {
    const path = url.searchParams.get('path') || '';
    const now = Date.now();
    if (!PATH_RE.test(path)) return json({ error: 'bad_path' }, 400);
    const old = (await loadDocs(db, [path]))[path] || null;
    if (method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_DOC) return json({ error: 'too_large' }, 413);
      let data;
      try { data = JSON.parse(text); } catch (e) { return json({ error: 'bad_json' }, 400); }
      const bad = checkDoc(path, data);
      if (bad) return json({ error: bad }, bad === 'too_large' ? 413 : 400);
      if (!canWrite(me, path, 'put', old, data)) return json({ error: 'forbidden' }, 403);
      await putStmt(db, path, JSON.stringify(data), now).run();
      return json({ ok: true, updated: now });
    }
    if (method === 'DELETE') {
      if (!canWrite(me, path, 'del', old, null)) return json({ error: 'forbidden' }, 403);
      await delStmt(db, path, now).run();
      return json({ ok: true, updated: now });
    }
  }

  if (route === 'batch' && method === 'POST') {
    const body = await readBody(request);
    if (!body) return json({ error: 'bad_json' }, 400);
    const puts = Array.isArray(body.puts) ? body.puts : [];
    const dels = Array.isArray(body.dels) ? body.dels : [];
    if (puts.length + dels.length > 100) return json({ error: 'too_many' }, 400);
    for (const p of puts) { const bad = checkDoc(p && p.path, p && p.data); if (bad) return json({ error: bad, path: p && p.path }, 400); }
    for (const path of dels) if (!PATH_RE.test(path || '')) return json({ error: 'bad_path', path }, 400);
    const needOld = puts.map(p => p.path).concat(dels).filter(p => p.startsWith('sequences/') || /^clients\/[^/]+$/.test(p));
    const old = needOld.length ? await loadDocs(db, needOld) : {};
    for (const p of puts) if (!canWrite(me, p.path, 'put', old[p.path] || null, p.data)) return json({ error: 'forbidden', path: p.path }, 403);
    for (const path of dels) if (!canWrite(me, path, 'del', old[path] || null, null)) return json({ error: 'forbidden', path }, 403);
    const now = Date.now();
    const stmts = puts.map(p => putStmt(db, p.path, JSON.stringify(p.data), now)).concat(dels.map(path => delStmt(db, path, now)));
    if (stmts.length) await db.batch(stmts);
    return json({ ok: true, updated: now, count: stmts.length });
  }

  return json({ error: 'not_found' }, 404);
}
