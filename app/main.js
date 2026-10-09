/* Fastex Outreach Desk — main.js
   App shell: navigation rail, banners, modal registry and boot. */
'use strict';

const VIEWS = ['today', 'prospects', 'activity', 'clients', 'sequences', 'reports', 'settings'];

const MODALS = {
  addProspect: p => html`<${AddProspectModal} clientId=${p.clientId} />`,
  bulk: p => html`<${BulkAddModal} clientId=${p.clientId} />`,
  client: p => html`<${ClientModal} id=${p.id} />`,
  confirm: p => html`<${ConfirmModal} ...${p} />`,
  date: p => html`<${DateModal} ...${p} />`,
  text: p => html`<${TextModal} ...${p} />`,
  accept: p => html`<${AcceptanceModal} accountKey=${p.key} />`,
  run: p => html`<${RunModal} accountKey=${p.key} />`,
  reply: p => html`<${ReplyModal} p=${p.p} mode=${p.mode} back=${p.back} />`,
  withdraw: p => html`<${WithdrawModal} p=${p.p} />`,
  changeSeq: p => html`<${ChangeSequenceModal} ps=${p.ps} />`,
  newSeq: p => html`<${NewSequenceModal} clientId=${p.clientId} />`,
  lists: p => html`<${ListsModal} clientId=${p.clientId} />`,
  setList: p => html`<${SetListModal} ps=${p.ps} />`,
  find: () => html`<${QuickFind} />`,
  people: () => html`<${PeopleModal} />`,
  help: p => html`<${HelpModal} view=${p.view} />`,
  bookmarklet: () => html`<${BookmarkletModal} />`,
  engage: p => html`<${EngageModal} p=${p.p} />`,
  importFile: p => html`<${ImportFileModal} obj=${p.obj} fileName=${p.fileName} />`,
};

/* Ctrl/Cmd+K: jump to any prospect, client or screen. */
function QuickFind() {
  const data = currentData();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    const out = [];
    if (!needle) {
      VIEWS.forEach(v => out.push({ kind: 'view', label: v.charAt(0).toUpperCase() + v.slice(1), sub: 'Go to screen', go: () => UI.go(v) }));
      return out;
    }
    for (const p of data.prospects) {
      if (haystack(p).indexOf(needle) === -1) continue;
      out.push({ kind: 'prospect', label: fullName(p), sub: [p.title, p.company, (data.clients[p.clientId] || {}).name].filter(Boolean).join(' · '), p, go: () => UI.openProspect(p) });
      if (out.length >= 12) break;
    }
    Object.values(data.clients).forEach(c => { if (c.name.toLowerCase().indexOf(needle) !== -1) out.push({ kind: 'client', label: c.name, sub: 'Client · open prospects', go: () => UI.go('prospects', { prospectFilter: Object.assign({}, UI.prospectFilter, { clientId: c.id, listId: '', senderId: '' }) }) }); });
    VIEWS.forEach(v => { if (v.indexOf(needle) === 0) out.push({ kind: 'view', label: v.charAt(0).toUpperCase() + v.slice(1), sub: 'Go to screen', go: () => UI.go(v) }); });
    return out;
  }, [needle, data]);
  const pick = r => { if (!r) return; UI.close(); r.go(); };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(idx + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(idx - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[idx]); }
  };
  return html`<${Modal} title="Find" size="narrow">
    <label class="search"><${Icon} n="search" s=${15} /><span class="sr">Search</span>
      <input id="qf-input" class="input" data-autofocus placeholder="Prospect, company, client or screen…" value=${q} onInput=${e => { setQ(e.target.value); setIdx(0); }} onKeyDown=${onKey} /></label>
    <ul class="find-list">
      ${results.map((r, i) => html`<li key=${i}><button type="button" class=${i === idx ? 'on' : ''} onMouseEnter=${() => setIdx(i)} onClick=${() => pick(r)}>
        <${Icon} n=${r.kind === 'prospect' ? 'user' : r.kind === 'client' ? 'briefcase' : 'chevRight'} s=${14} />
        <span><strong>${r.label}</strong><br /><span class="muted">${r.sub}</span></span>
        ${r.p && html`<${StatusPill} status=${r.p.status} />`}
      </button></li>`)}
      ${needle && !results.length && html`<li class="muted" style="padding:10px">No matches.</li>`}
    </ul>
    <p class="muted" style="font-size:12px">↑ ↓ to move · Enter to open · Esc to close</p>
  <//>`;
}
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); UI.open('find', {}); }
});
function ThemeToggle() {
  const cur = pref('theme') || 'system';
  const next = { system: 'light', light: 'dark', dark: 'system' }[cur] || 'light';
  const icon = { system: 'monitor', light: 'sun', dark: 'moon' }[cur];
  return html`<button type="button" class="btn sm ghost" title=${'Theme: ' + cur + ' (click for ' + next + ')'} onClick=${() => { pref('theme', next); applyTheme(next); bump(); }}><${Icon} n=${icon} s=${14} />${cur === 'system' ? 'Auto' : cur === 'light' ? 'Light' : 'Dark'}</button>`;
}

function Rail({ counts }) {
  const data = currentData();
  const items = [
    ['today', 'Today', 'today', counts.open],
    ['prospects', 'Prospects', 'users', data.prospects.length],
    ['activity', 'Activity', 'activity', null],
    ['clients', 'Clients', 'briefcase', Object.values(data.clients).filter(c => c.status !== 'archived').length],
    ['sequences', 'Sequences', 'route', null],
    ['reports', 'Reports', 'chart', null],
    ['settings', 'Settings', 'sliders', null],
  ];
  const hasTeam = (data.settings.team || []).length > 0;
  return html`<nav class="rail" aria-label="Main">
    <div class="brand">
      <span class="brand-mark"><${Icon} n="send" s=${16} /></span>
      <div><div class="brand-name">${data.settings.agencyName || 'Fastex'}</div><div class="brand-sub">Outreach desk</div></div>
    </div>
    <button type="button" class="find-btn" onClick=${() => UI.open('find', {})}><${Icon} n="search" s=${14} /><span>Find…</span><kbd>⌘K</kbd></button>
    <div class="nav">
      ${items.map(([k, label, icon, n]) => html`<button type="button" key=${k} class="nav-item" aria-current=${UI.view === k ? 'page' : undefined} onClick=${() => UI.go(k)}>
        <${Icon} n=${icon} /><span>${label}</span>${n != null && n > 0 && html`<span class=${'count' + (k === 'today' ? ' hot' : '')}>${fmtNum(n)}</span>`}
      </button>`)}
    </div>
    <div class="rail-foot">
      ${hasTeam ? html`<label for="rail-me">You</label>
        <${MemberSelect} id="rail-me" cls="select sm" settings=${data.settings} value=${UI.me} noneLabel="Pick your name" onChange=${x => { pref('me', x || null); UI.set({ me: x }); }} />`
        : html`<button type="button" class="btn sm" onClick=${() => UI.go('settings')}><${Icon} n="users" s=${14} />Add your team</button>`}
      <${ThemeToggle} />
      <${SyncStatus} />
    </div>
  </nav>`;
}

function SyncStatus() {
  if (Store.mode === 'server') {
    const off = Store.sync.state === 'offline';
    const ago = Store.sync.last ? Math.max(0, Math.round((Date.now() - Store.sync.last) / 1000)) : null;
    return html`<button type="button" class="sync linkish" title=${off ? 'Cannot reach the shared workspace. Retrying.' : 'Saved on Cloudflare. Everyone with the passcode sees the same data.'} onClick=${() => Store.real && Store.real.backend.sync()}>
      <span class=${'dot ' + (off ? 'local' : '')}></span>${off ? 'Offline · retrying' : 'Shared · synced' + (ago != null && ago > 15 ? ' ' + (ago < 120 ? ago + 's' : Math.round(ago / 60) + 'm') + ' ago' : '')}</button>`;
  }
  return html`<div class="sync"><span class=${'dot ' + (Store.demoOn ? 'demo' : Store.mode === 'local' ? 'local' : '')}></span>
    ${Store.demoOn ? 'Sample data' : Store.mode === 'cloud' ? 'Shared with your team' : 'Saved in this browser only'}</div>`;
}

/* Team passcode screen for the shared Cloudflare workspace. */
function Gate() {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(Store.gateError || '');
  const n = Object.keys(localDocs()).length;
  const submit = async e => {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setBusy(true); setErr('');
    const r = await checkPasscode(k);
    setBusy(false);
    if (r === 'wrong') { setErr('That passcode is not right. Check with whoever set up the desk.'); return; }
    if (r === 'down') { setErr('Could not reach the shared workspace. Check your internet connection and try again.'); return; }
    pref('workspaceKey', k);
    pref('forceLocal', null);
    Store.gateError = '';
    connectServer(k);
  };
  return html`<div class="gate-screen">
    <form class="gate-card" onSubmit=${submit}>
      <span class="brand-mark" style="width:44px;height:44px;border-radius:12px"><${Icon} n="send" s=${20} /></span>
      <h1>Outreach Desk</h1>
      <p class="soft">This workspace is shared by your team. Enter the team passcode to open it on this browser. You only need to do this once per browser.</p>
      <label class="field"><span>Team passcode</span>
        <input id="gate-key" class="input" type="password" autocomplete="current-password" data-autofocus autofocus value=${key} onInput=${ev => setKey(ev.target.value)} /></label>
      ${err && html`<div class="note-box bad">${err}</div>`}
      <button type="submit" class="btn primary" disabled=${busy || !key.trim()}>${busy ? 'Checking…' : 'Open shared workspace'}</button>
      <p class="muted" style="font-size:12.5px">Don't have it? Ask the person who set up the desk. The passcode is set in Cloudflare, not here.</p>
      ${n > 0 && html`<p class="muted" style="font-size:12.5px">This browser also has ${plural(n, 'record')} saved from before. After you sign in you can copy them into the shared workspace.</p>`}
      <button type="button" class="btn sm ghost" onClick=${() => { pref('forceLocal', true); startLocal(); }}>Use this browser only instead</button>
    </form>
  </div>`;
}

async function startWorkspace() {
  exitDemo(true);
  if (Store.readOnly) { UI.toast('You have view-only access to this workspace.', { bad: true }); return; }
  await ensureDefaultSequence();
  UI.go('clients');
  UI.open('client', {});
}

function Banners() {
  const [hideLocal, setHideLocal] = useState(!!pref('hideLocalBanner'));
  const out = [];
  if (Store.demoOn) {
    out.push(html`<div class="banner" key="demo"><${Icon} n="info" />
      <p><strong>You're looking at sample data.</strong> Three example clients, so you can see how the desk works. Nothing you do here is saved.</p>
      <div class="btn-row">
        ${Store.demoAuto
          ? html`<button type="button" class="btn primary" onClick=${startWorkspace}>Set up my workspace</button>`
          : html`<button type="button" class="btn" onClick=${() => exitDemo(true)}>Back to my workspace</button>`}
      </div></div>`);
  } else if (Store.mode === 'server' && Store.localPending) {
    const lp = Store.localPending, up = Store.uploadProgress;
    out.push(html`<div class="banner" key="upload"><${Icon} n="upload" />
      <p><strong>This browser has data from before you switched to the shared workspace:</strong> ${[lp.clients && plural(lp.clients, 'client'), lp.sequences && plural(lp.sequences, 'sequence'), lp.prospects && plural(lp.prospects, 'prospect')].filter(Boolean).join(', ') || plural(lp.total, 'record')}. Copy it in so the whole team sees it. Anything already shared is left as it is.</p>
      <div class="btn-row">
        <button type="button" class="btn primary" disabled=${!!up} onClick=${uploadLocalData}>${up ? 'Uploading ' + up.done + ' of ' + up.total + '…' : 'Upload to shared workspace'}</button>
        <button type="button" class="btn sm ghost" disabled=${!!up} onClick=${() => { Store.localPending = null; bump(); }}>Not now</button>
      </div></div>`);
  } else if (Store.mode === 'local' && !hideLocal) {
    out.push(html`<div class="banner local" key="local"><${Icon} n="alert" />
      <p><strong>Saved in this browser only.</strong> Each browser keeps its own copy. Export a backup from Settings now and then, and restore it on another device if you switch.</p>
      <button type="button" class="btn sm ghost" onClick=${() => { pref('hideLocalBanner', true); setHideLocal(true); }}>Got it</button></div>`);
  }
  if (VIEWS.indexOf(UI.view) !== -1 && Object.keys(currentData().clients).length) out.push(html`<${PageHint} key=${'hint-' + UI.view} view=${UI.view} />`);
  if (Store.readOnly && !Store.demoOn) {
    out.push(html`<div class="banner ro" key="ro"><${Icon} n="info" /><p><strong>View only.</strong> Ask the owner for edit access to log activity here.</p></div>`);
  }
  if (!out.length) return null;
  return html`<div class="banners">${out}</div>`;
}

function Boundary({ children }) {
  const [err, reset] = useErrorBoundary(e => { try { console.error(e); } catch (x) { /* ignore */ } });
  if (err) {
    return html`<div class="page"><div class="panel"><${Empty} icon="alert" title="This screen hit an error"
      action=${html`<button type="button" class="btn" onClick=${reset}>Try again</button>`}>${String((err && err.message) || err)}</${Empty}></div></div>`;
  }
  return children;
}

function App() {
  const [, force] = useState(0);
  const seen = useRef(Store.ver);
  useLayoutEffect(() => {
    const f = () => { seen.current = Store.ver; force(n => n + 1); };
    Store.listeners.add(f);
    if (Store.ver !== seen.current) f();
    return () => { Store.listeners.delete(f); };
  }, []);
  const data = currentData();
  const loading = !Store.real || !Store.real.ready() || !Store.decided;
  const board = useMemo(() => (loading ? null : buildBoard(data, { today: TODAY })), [data, TODAY, loading]);
  const counts = board ? board.counts : { open: 0 };
  let view;
  if (Store.mode === 'gate') return html`<div><${Gate} /><${Toasts} /></div>`;
  if (loading) {
    view = html`<div class="boot"><div><div class="spinner"></div>${Store.mode === 'boot' ? 'Connecting…' : 'Loading your workspace…'}</div></div>`;
  } else if (UI.view === 'prospects') view = html`<${ProspectsView} />`;
  else if (UI.view === 'clients') view = html`<${ClientsView} />`;
  else if (UI.view === 'sequences') view = html`<${SequencesView} />`;
  else if (UI.view === 'activity') view = html`<${ActivityView} />`;
  else if (UI.view === 'reports') view = html`<${ReportsView} />`;
  else if (UI.view === 'settings') view = html`<${SettingsView} />`;
  else view = html`<${TodayView} />`;
  const modal = !loading && UI.modal && MODALS[UI.modal.type];
  return html`<div class="shell">
    <${Rail} counts=${counts} />
    <main class="main" id="main">
      ${!loading && html`<${Banners} />`}
      <${Boundary} key=${UI.view}>${view}<//>
    </main>
    ${!loading && UI.drawer && html`<${Boundary} key=${'d' + UI.drawer.cid + UI.drawer.pid}><${ProspectDrawer} cid=${UI.drawer.cid} pid=${UI.drawer.pid} /><//>`}
    ${modal && html`<div key=${'m' + UI.modal.n}><${Boundary}>${modal(UI.modal.props)}<//></div>`}
    <${Toasts} />
    <${CountryList} />
  </div>`;
}

(function start() {
  const initial = (location.hash || '').replace('#', '') || pref('view');
  if (VIEWS.indexOf(initial) !== -1) UI.view = initial;
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
  bootStore().catch(e => {
    try { console.error(e); } catch (x) { /* ignore */ }
    Store.mode = 'local';
    Store.real = Dataset(LocalBackend({ key: 'fod.data.v1', persist: true }), onDatasetChange);
    Store.real.start();
    bump();
  });
})();
