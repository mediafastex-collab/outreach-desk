/* Fastex Outreach Desk — shared storage API (Cloudflare Pages Function + D1).
   Every request except /api/status must carry the team passcode in the X-Workspace-Key header.
   Routes:
     GET    /api/status                 → is storage set up?
     GET    /api/sync?since=<ms>        → documents changed after <ms> (deletions included)
     PUT    /api/doc?path=<path>        → create or replace one document (JSON body)
     DELETE /api/doc?path=<path>        → delete one document
     POST   /api/batch                  → { puts: [{path, data}], dels: [path] } up to 100 at once
   Bindings (set in Cloudflare): DB = a D1 database, WORKSPACE_KEY = the team passcode (secret). */

const PATH_RE = /^(meta|clients|sequences)\/[A-Za-z0-9_\-.~:@+]{1,200}$|^clients\/[A-Za-z0-9_\-.~:@+]{1,200}\/prospects\/[A-Za-z0-9_\-.~:@+]{1,200}$/;
const MAX_DOC = 262144;
const PAGE = 2000;
let ready = false;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
async function ensureTable(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data TEXT, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS docs_updated ON docs (updated_at)'),
  ]);
  ready = true;
}
async function sameKey(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(given))), crypto.subtle.digest('SHA-256', enc.encode(String(expected)))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
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

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const hasDb = !!env.DB;
  const hasKey = !!(env.WORKSPACE_KEY && String(env.WORKSPACE_KEY).length >= 6);

  if (route === 'status') return json({ app: 'fastex-outreach-desk', configured: hasDb && hasKey, hasDb, hasKey });
  if (!hasDb || !hasKey) return json({ error: 'not_configured' }, 503);

  const given = request.headers.get('x-workspace-key') || '';
  if (!given || !(await sameKey(given, env.WORKSPACE_KEY))) return json({ error: 'bad_key' }, 401);

  await ensureTable(env.DB);
  const url = new URL(request.url);

  if (route === 'sync' && request.method === 'GET') {
    const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
    const res = await env.DB.prepare('SELECT path, data, updated_at, deleted FROM docs WHERE updated_at > ?1 ORDER BY updated_at LIMIT ' + PAGE).bind(since).all();
    const rows = res.results || [];
    return json({
      now: Date.now(),
      more: rows.length === PAGE,
      docs: rows.map(r => ({ path: r.path, updated: r.updated_at, deleted: !!r.deleted, data: r.deleted ? null : JSON.parse(r.data) })),
    });
  }

  if (route === 'doc') {
    const path = url.searchParams.get('path') || '';
    const now = Date.now();
    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_DOC) return json({ error: 'too_large' }, 413);
      let data;
      try { data = JSON.parse(text); } catch (e) { return json({ error: 'bad_json' }, 400); }
      const bad = checkDoc(path, data);
      if (bad) return json({ error: bad }, bad === 'too_large' ? 413 : 400);
      await putStmt(env.DB, path, JSON.stringify(data), now).run();
      return json({ ok: true, updated: now });
    }
    if (request.method === 'DELETE') {
      if (!PATH_RE.test(path)) return json({ error: 'bad_path' }, 400);
      await delStmt(env.DB, path, now).run();
      return json({ ok: true, updated: now });
    }
  }

  if (route === 'batch' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
    const puts = Array.isArray(body.puts) ? body.puts : [];
    const dels = Array.isArray(body.dels) ? body.dels : [];
    if (puts.length + dels.length > 100) return json({ error: 'too_many' }, 400);
    const now = Date.now();
    const stmts = [];
    for (const p of puts) {
      const bad = checkDoc(p && p.path, p && p.data);
      if (bad) return json({ error: bad, path: p && p.path }, 400);
      stmts.push(putStmt(env.DB, p.path, JSON.stringify(p.data), now));
    }
    for (const path of dels) {
      if (!PATH_RE.test(path || '')) return json({ error: 'bad_path', path }, 400);
      stmts.push(delStmt(env.DB, path, now));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, updated: now, count: stmts.length });
  }

  return json({ error: 'not_found' }, 404);
}
