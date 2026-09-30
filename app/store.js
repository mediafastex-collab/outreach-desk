/* Fastex Outreach Desk — store.js
   Storage backends and live datasets:
   - cloud: the artifact's shared database (everyone with edit access sees the same data, live)
   - local: this browser only (used when the page is opened as a plain file)
   The app always starts empty: there is no sample or test data. */
'use strict';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function errCode(e) { return (e && e.code) || 'unavailable'; }

const capCache = {};
function capability(name) {
  if (!(name in capCache)) {
    const c = window.claude;
    capCache[name] = c && typeof c.use === 'function'
      ? Promise.race([Promise.resolve().then(() => c.use(name)).catch(() => null), wait(12000).then(() => null)])
      : Promise.resolve(null);
  }
  return capCache[name];
}

function CloudBackend(db) {
  const queues = new Map();
  function run(path, fn) {
    const prev = queues.get(path) || Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      for (let attempt = 0; ; attempt++) {
        try { return await fn(); }
        catch (e) {
          const c = errCode(e);
          if ((c === 'unavailable' && attempt < 2) || (c === 'resource_exhausted' && attempt < 6)) {
            await wait(500 * (attempt + 1) + Math.random() * 500);
            continue;
          }
          throw e;
        }
      }
    });
    queues.set(path, next);
    const done = () => { if (queues.get(path) === next) queues.delete(path); };
    next.then(done, done);
    return next;
  }
  return {
    kind: 'cloud',
    listen(col, onDocs, onError) {
      let unsub = null, dead = false;
      const start = () => {
        try {
          unsub = db.collection(col).onSnapshot(
            snap => onDocs(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]), snap.metadata || {}),
            err => {
              if (dead) return;
              if (errCode(err) === 'unavailable') setTimeout(() => { if (!dead) start(); }, 2500);
              else if (onError) onError(err);
            });
        } catch (e) { if (onError) onError(e); }
      };
      start();
      return () => { dead = true; try { if (unsub) unsub(); } catch (e) { /* already closed */ } };
    },
    set(path, data) { return run(path, () => db.doc(path).set(data)); },
    del(path) { return run(path, () => db.doc(path).delete()); },
  };
}

function LocalBackend(opts) {
  const key = opts.key;
  const persist = !!opts.persist;
  let docs = {};
  if (opts.seed) docs = opts.seed;
  else if (persist) { try { docs = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { docs = {}; } }
  const subs = new Map();
  const colOf = path => path.slice(0, path.lastIndexOf('/'));
  const list = col => Object.keys(docs).filter(p => colOf(p) === col).map(p => [p.slice(p.lastIndexOf('/') + 1), docs[p]]);
  const notify = col => { const s = subs.get(col); if (s) for (const cb of Array.from(s)) cb(list(col), { fromCache: false }); };
  let timer = null;
  const flush = () => { clearTimeout(timer); timer = null; if (!persist) return; try { localStorage.setItem(key, JSON.stringify(docs)); } catch (e) { if (opts.onError) opts.onError(e); } };
  const save = () => { if (!persist) return; clearTimeout(timer); timer = setTimeout(flush, 120); };
  if (persist) {
    window.addEventListener('pagehide', flush);
    window.addEventListener('storage', e => {
      if (e.key !== key) return;
      try { docs = JSON.parse(e.newValue || '{}') || {}; } catch (er) { return; }
      for (const col of subs.keys()) notify(col);
    });
  }
  return {
    kind: persist ? 'local' : 'demo',
    listen(col, onDocs) {
      if (!subs.has(col)) subs.set(col, new Set());
      subs.get(col).add(onDocs);
      Promise.resolve().then(() => { const s = subs.get(col); if (s && s.has(onDocs)) onDocs(list(col), { fromCache: false }); });
      return () => { const s = subs.get(col); if (s) s.delete(onDocs); };
    },
    async set(path, data) { docs[path] = clone(data); save(); notify(colOf(path)); },
    async del(path) { delete docs[path]; save(); notify(colOf(path)); },
  };
}

/* A live view of one backend: clients, sequences, settings and every client's prospects. */
function Dataset(backend, onChange) {
  const ds = { backend, clients: {}, sequences: {}, prospects: {}, settingsDoc: null, got: {}, definitive: {}, pGot: {}, ver: 0 };
  let subs = [], pSubs = {};
  const changed = () => { ds.ver++; onChange(ds); };
  const onErr = e => onChange(ds, e);
  const toMap = docs => { const m = {}; for (const [id, d] of docs) m[id] = Object.assign({}, d, { id }); return m; };
  function syncProspects() {
    for (const cid of Object.keys(ds.clients)) {
      if (pSubs[cid]) continue;
      pSubs[cid] = backend.listen('clients/' + cid + '/prospects', docs => {
        const m = {};
        for (const [id, d] of docs) m[id] = Object.assign({}, d, { id, clientId: cid });
        ds.prospects[cid] = m;
        ds.pGot[cid] = true;
        changed();
      }, onErr);
    }
    for (const cid of Object.keys(pSubs)) {
      if (ds.clients[cid]) continue;
      pSubs[cid]();
      delete pSubs[cid]; delete ds.prospects[cid]; delete ds.pGot[cid];
    }
  }
  ds.start = () => {
    subs.push(backend.listen('clients', (docs, meta) => {
      ds.clients = toMap(docs); ds.got.clients = true;
      if (!meta.fromCache) ds.definitive.clients = true;
      syncProspects(); changed();
    }, onErr));
    subs.push(backend.listen('sequences', (docs, meta) => {
      ds.sequences = toMap(docs); ds.got.sequences = true;
      if (!meta.fromCache) ds.definitive.sequences = true;
      changed();
    }, onErr));
    subs.push(backend.listen('meta', docs => {
      const m = toMap(docs);
      ds.settingsDoc = m.settings || null; ds.got.meta = true;
      changed();
    }, onErr));
  };
  ds.stop = () => { subs.forEach(u => u()); subs = []; Object.values(pSubs).forEach(u => u()); pSubs = {}; };
  ds.ready = () => !!(ds.got.clients && ds.got.sequences && ds.got.meta);
  ds.allLoaded = () => ds.ready() && Object.keys(ds.clients).every(cid => ds.pGot[cid]);
  return ds;
}

/* ---------- app-level store ---------- */
const Store = {
  mode: 'boot',            // 'boot' | 'cloud' | 'local'
  real: null,
  demo: null,
  demoOn: false,
  demoAuto: false,
  decided: false,
  readOnly: false,
  lastError: null,
  ver: 0,
  listeners: new Set(),
  active() { return this.demoOn && this.demo ? this.demo : this.real; },
};

let bumpQueued = false;
function bump() {
  Store.ver++;
  if (bumpQueued) return;
  bumpQueued = true;
  let ran = false;
  const run = () => { if (ran) return; ran = true; bumpQueued = false; Store.listeners.forEach(f => f()); };
  requestAnimationFrame(run);
  setTimeout(run, 60);
}

function pref(k, v) {
  try {
    if (v === undefined) { const raw = localStorage.getItem('fod.' + k); return raw == null ? null : JSON.parse(raw); }
    if (v === null) localStorage.removeItem('fod.' + k); else localStorage.setItem('fod.' + k, JSON.stringify(v));
  } catch (e) { /* storage blocked: preferences just won't persist */ }
  return v;
}

const EMPTY_DATA = { clients: {}, seqs: {}, prospects: [], settings: DEFAULT_SETTINGS, ready: false, allLoaded: false, ver: -1, kind: 'boot' };
function currentData() {
  const ds = Store.active();
  if (!ds) return EMPTY_DATA;
  if (ds._cacheVer === ds.ver && ds._cache) return ds._cache;
  const prospects = [];
  for (const cid in ds.prospects) for (const pid in ds.prospects[cid]) prospects.push(ds.prospects[cid][pid]);
  const settings = Object.assign({}, DEFAULT_SETTINGS, ds.settingsDoc || {});
  if (!Array.isArray(settings.team)) settings.team = [];
  if (!Array.isArray(settings.workDays)) settings.workDays = DEFAULT_SETTINGS.workDays;
  ds._cache = { clients: ds.clients, seqs: ds.sequences, prospects, settings, ready: ds.ready(), allLoaded: ds.allLoaded(), ver: ds.ver, kind: ds.backend.kind };
  ds._cacheVer = ds.ver;
  return ds._cache;
}

function onDatasetChange(ds, err) {
  if (err) {
    Store.lastError = err;
    if (errCode(err) === 'revoked' || errCode(err) === 'not_granted') Store.readOnly = true;
  }
  if (ds === Store.real) maybeDecideDemo();
  bump();
}

let decideTimer = null;
function maybeDecideDemo() {
  const r = Store.real;
  if (!r || !r.ready()) return;
  const empty = Object.keys(r.clients).length === 0;
  if (Store.demoOn && Store.demoAuto && !empty) {
    exitDemo(false);
    UI.toast('Your workspace has data now, so the sample is closed.');
    return;
  }
  if (Store.decided) return;
  const definitive = r.backend.kind !== 'cloud' || (r.definitive.clients && r.definitive.sequences);
  const decide = () => {
    if (Store.decided) return;
    Store.decided = true;
    bump();
  };
  if (definitive) decide();
  else if (!decideTimer) decideTimer = setTimeout(decide, 4000);
}

function enterDemo(auto) {
  if (Store.demo) Store.demo.stop();
  Store.demo = Dataset(LocalBackend({ key: 'demo', persist: false, seed: {} }), onDatasetChange);
  Store.demo.start();
  Store.demoOn = true;
  Store.demoAuto = !!auto;
  bump();
}
function exitDemo(remember) {
  if (Store.demo) Store.demo.stop();
  Store.demo = null;
  Store.demoOn = false;
  Store.demoAuto = false;
  if (remember) pref('demoDismissed', true);
  bump();
}

async function bootStore() {
  const db = await capability('db');
  if (db) {
    Store.mode = 'cloud';
    Store.real = Dataset(CloudBackend(db), onDatasetChange);
  } else {
    Store.mode = 'local';
    Store.real = Dataset(LocalBackend({ key: 'fod.data.v1', persist: true, onError: () => UI.toast('This browser refused to save. Export a backup from Settings.', { bad: true }) }), onDatasetChange);
  }
  Store.real.start();
  bump();
  const user = await capability('user');
  if (user && typeof user.can === 'function') {
    try { if ((await user.can('data.write')) === false) { Store.readOnly = true; bump(); } } catch (e) { /* unknown: let writes decide */ }
  }
}

/* ---------- writes ---------- */
function stripDoc(doc) { const d = JSON.parse(JSON.stringify(doc)); delete d.id; return d; }
function prospectPath(p) { return 'clients/' + p.clientId + '/prospects/' + p.id; }
function handleWriteError(e) {
  const c = errCode(e);
  if (c === 'invalid_argument' && Store.mode === 'cloud' && !Store.demoOn) {
    Store.readOnly = true;
    UI.toast('That change was refused. You may only have view access to this workspace.', { bad: true });
  } else if (c === 'quota_exceeded') {
    UI.toast('Storage is full. Delete old prospects or clients, then try again.', { bad: true });
  } else {
    UI.toast('Could not save that change. Check your connection and try again.', { bad: true });
  }
  bump();
}
const W = {
  guard() {
    if (Store.readOnly && !Store.demoOn) { UI.toast('You have view-only access here.', { bad: true }); return false; }
    return true;
  },
  async put(path, doc, quiet) {
    const ds = Store.active();
    try { await ds.backend.set(path, stripDoc(doc)); return true; }
    catch (e) { if (quiet) { Store.lastError = e; return false; } handleWriteError(e); return false; }
  },
  async del(path, quiet) {
    const ds = Store.active();
    try { await ds.backend.del(path); return true; }
    catch (e) { if (quiet) { Store.lastError = e; return false; } handleWriteError(e); return false; }
  },
  saveProspect(p) { return W.put(prospectPath(p), p); },
  deleteProspect(p) { return W.del(prospectPath(p)); },
  saveClient(c) { return W.put('clients/' + c.id, c); },
  saveSequence(s) { return W.put('sequences/' + s.id, s); },
  deleteSequence(s) { return W.del('sequences/' + s.id); },
  saveSettings(patch) {
    const cur = currentData().settings;
    const next = Object.assign({}, cur, patch, { updatedAt: nowTs() });
    return W.put('meta/settings', next);
  },
  /* Writes many docs with modest parallelism; reports progress. */
  async many(items, fn, onProgress) {
    let done = 0, failed = 0, i = 0;
    const worker = async () => {
      while (i < items.length) {
        const item = items[i++];
        const ok = await fn(item);
        if (ok === false) failed++;
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return { done, failed };
  },
};
