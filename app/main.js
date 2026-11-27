/* Fastex Outreach Desk — main.js
   App shell: navigation rail, banners, modal registry and boot. */
'use strict';

const VIEWS = ['today', 'prospects', 'activity', 'clients', 'sequences', 'reports', 'users', 'settings'];

const MODALS = {
  addProspect: p => html`<${AddProspectModal} clientId=${p.clientId} />`,
  bulk: p => html`<${BulkAddModal} clientId=${p.clientId} />`,
  client: p => html`<${ClientModal} id=${p.id} />`,
  confirm: p => html`<${ConfirmModal} ...${p} />`,
  date: p => html`<${DateModal} ...${p} />`,
  range: p => html`<${RangeModal} ...${p} />`,
  password: () => html`<${PasswordModal} />`,
  user: p => html`<${UserModal} ...${p} />`,
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

function Rail({ counts }) {
  const data = currentData();
  const items = [
    ['today', 'Today', 'today', counts.open],
    ['prospects', 'Prospects', 'users', data.prospects.length],
    ['activity', 'Activity', 'activity', null],
    ['clients', 'Clients', 'briefcase', Object.values(data.clients).filter(c => c.status !== 'archived').length],
    ['sequences', 'Sequences', 'route', null],
    ['reports', 'Reports', 'chart', null],
    Store.user && can('users') ? ['users', 'Team & access', 'shield', null] : null,
    ['settings', 'Settings', 'sliders', null],
  ].filter(Boolean);
  const hasTeam = (data.settings.team || []).length > 0;
  return html`<nav class="rail" aria-label="Main">
    <div class="brand">
      <span class="brand-mark"><${FxMark} size=${22} /></span>
      <div><div class="brand-name">${data.settings.agencyName || 'Fastex'}</div><div class="brand-sub">Outreach desk</div></div>
    </div>
    <${WorkspaceSwitcher} />
    <button type="button" class="find-btn" onClick=${() => UI.open('find', {})}><${Icon} n="search" s=${14} /><span>Find…</span><kbd>⌘K</kbd></button>
    <div class="nav">
      ${items.map(([k, label, icon, n]) => html`<button type="button" key=${k} class="nav-item" aria-current=${UI.view === k ? 'page' : undefined} onClick=${() => UI.go(k)}>
        <${Icon} n=${icon} /><span>${label}</span>${n != null && n > 0 && html`<span class=${'count' + (k === 'today' ? ' hot' : '')}>${fmtNum(n)}</span>`}
      </button>`)}
    </div>
    <div class="rail-foot">
      ${Store.user ? html`<div class="me-card">
          <span class="me-av">${(Store.user.name || '?').trim().charAt(0).toUpperCase()}</span>
          <span class="me-text"><strong>${Store.user.name}</strong><span class="muted">${ROLE_INFO[Store.user.role] ? ROLE_INFO[Store.user.role].label : Store.user.role}${Store.user.clients ? ' · ' + plural(Store.user.clients.length, 'client') : ''}</span></span>
          <${Menu} icon="more" title="Your account" items=${[
            { label: 'Change password', icon: 'lock', onSelect: () => UI.open('password', {}) },
          ]} />
        </div>`
        : hasTeam ? html`<label for="rail-me">You</label>
        <${MemberSelect} id="rail-me" cls="select sm" settings=${data.settings} value=${UI.me} noneLabel="Pick your name" onChange=${x => { pref('me', x || null); UI.set({ me: x }); }} />`
        : html`<button type="button" class="btn sm" onClick=${() => UI.go('settings')}><${Icon} n="users" s=${14} />Add your team</button>`}
      <${SyncStatus} />
      ${Store.user && html`<button type="button" id="rail-logout" class="btn sm ghost" onClick=${() => UI.open('confirm', { title: 'Log out?', body: 'You\'ll need your email and password to sign in again. Your work stays saved in the shared workspace.', confirmLabel: 'Log out', onConfirm: () => { pref('me', null); UI.set({ me: '' }); signOut(); } })}><${Icon} n="logout" s=${14} />Log out</button>`}
    </div>
  </nav>`;
}

/* Pick "All clients" or one client; every screen then shows only that client's data. */
function WorkspaceSwitcher() {
  const raw = rawData();
  const due = useMemo(() => {
    const m = {}; let total = 0;
    if (!raw.ready) return { m, total };
    const b = buildBoard(raw, { today: TODAY });
    b.accounts.forEach(a => { m[a.client.id] = (m[a.client.id] || 0) + a.tasks.length; total += a.tasks.length; });
    b.replies.forEach(r => { m[r.client.id] = (m[r.client.id] || 0) + 1; total++; });
    return { m, total };
  }, [raw, TODAY]);
  const list = Object.values(raw.clients).filter(c => c.status !== 'archived').sort((a, b) => byText(a.name, b.name));
  const cur = UI.scope && raw.clients[UI.scope];
  const items = [
    { header: 'Workspace' },
    { label: 'All clients', icon: 'briefcase', checked: !cur, meta: due.total ? due.total + ' due' : '', onSelect: () => UI.setScope('') },
    { divider: true },
    ...list.map(c => ({ label: c.name, dot: c.colorIdx, checked: !!cur && cur.id === c.id, meta: due.m[c.id] ? due.m[c.id] + ' due' : '', onSelect: () => { UI.setScope(c.id); UI.toast('Switched to ' + c.name + '. You now see only their data.'); } })),
    list.length === 0 ? { label: 'No clients yet', disabled: true, onSelect: () => {} } : null,
    { divider: true },
    { label: 'Manage clients', icon: 'sliders', onSelect: () => UI.go('clients') },
  ];
  const label = cur
    ? html`<span class=${'ws-dot c' + (((cur.colorIdx | 0) % CLIENT_COLORS + CLIENT_COLORS) % CLIENT_COLORS)}></span><span class="ws-text"><span class="ws-k">Client workspace</span><span class="ws-name">${cur.name}</span></span>`
    : html`<span class="ws-dot all"><${Icon} n="briefcase" s=${12} /></span><span class="ws-text"><span class="ws-k">Workspace</span><span class="ws-name">All clients</span></span>`;
  return html`<div class="ws-switch"><${Menu} btnClass="ws-btn" label=${label} title="Switch workspace" items=${items} /></div>`;
}

function SyncStatus() {
  if (Store.mode === 'server') {
    const off = Store.sync.state === 'offline';
    const ago = Store.sync.last ? Math.max(0, Math.round((Date.now() - Store.sync.last) / 1000)) : null;
    return html`<button type="button" class="sync linkish" title=${off ? 'Cannot reach the shared workspace. Retrying.' : 'Saved in the shared workspace on Cloudflare. Your team sees the same data.'} onClick=${() => Store.real && Store.real.backend.sync()}>
      <span class=${'dot ' + (off ? 'local' : '')}></span>${off ? 'Offline · retrying' : 'Shared · synced' + (ago != null && ago > 15 ? ' ' + (ago < 120 ? ago + 's' : Math.round(ago / 60) + 'm') + ' ago' : '')}</button>`;
  }
  return html`<div class="sync"><span class=${'dot ' + (Store.demoOn ? 'demo' : Store.mode === 'local' ? 'local' : '')}></span>
    ${Store.demoOn ? 'Sample data' : Store.mode === 'cloud' ? 'Shared with your team' : 'Saved in this browser only'}</div>`;
}

/* Sign-in screens for the shared Cloudflare workspace. */
function ForgotHelp() {
  const [open, setOpen] = useState(false);
  const wa = Store.serverInfo && Store.serverInfo.adminWhatsapp;
  if (!open) return html`<button type="button" class="linkish" style="font-size:13px;align-self:flex-start" onClick=${() => setOpen(true)}>Forgot password?</button>`;
  return html`<div class="note-box">
    <p style="margin-bottom:8px"><strong>Forgot your password?</strong> Your admin can set a new one for you in Team & access. You'll pick your own after signing in.</p>
    ${wa ? html`<a class="btn sm primary" href=${'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hi, I forgot my Outreach Desk password (outreach.fastexmedia.com). Can you reset it?')} target="_blank" rel="noopener noreferrer"><${Icon} n="send" s=${14} />Message the admin on WhatsApp</a>`
      : html`<p class="muted" style="font-size:12.5px">Message your workspace admin.</p>`}
  </div>`;
}
function Gate() {
  const [email, setEmail] = useState(pref('lastEmail') || '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(Store.gateError || '');
  const n = Object.keys(localDocs()).length;
  const submit = async e => {
    e.preventDefault();
    if (!email.trim() || !pw) return;
    setBusy(true); setErr('');
    const m = await signIn(email.trim(), pw);
    setBusy(false);
    if (m) { setErr(m); return; }
    pref('lastEmail', email.trim());
    Store.gateError = '';
  };
  return html`<div class="gate-screen">
    <form class="gate-card" onSubmit=${submit}>
      <span class="brand-mark big"><${FxMark} size=${34} /></span>
      <h1>Outreach Desk</h1>
      <p class="soft">Sign in with the email and password your admin gave you.</p>
      <label class="field"><span>Email</span>
        <input id="login-email" class="input" type="email" autocomplete="username" data-autofocus autofocus value=${email} onInput=${ev => setEmail(ev.target.value)} /></label>
      <label class="field"><span>Password</span>
        <input id="login-password" class="input" type="password" autocomplete="current-password" value=${pw} onInput=${ev => setPw(ev.target.value)} /></label>
      ${err && html`<div class="note-box bad">${err}</div>`}
      <button type="submit" class="btn primary" disabled=${busy || !email.trim() || !pw}>${busy ? 'Signing in…' : 'Sign in'}</button>
      <${ForgotHelp} />
      ${n > 0 && html`<p class="muted" style="font-size:12.5px">This browser also has ${plural(n, 'record')} saved from before. After you sign in you can copy them into the shared workspace.</p>`}
    </form>
  </div>`;
}
function SetupScreen() {
  const [v, setV] = useState({ code: '', name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setV(Object.assign({}, v, { [k]: e.target.value }));
  const ok = v.code && v.name.trim() && v.email.trim() && v.password.length >= 8 && v.password === v.confirm;
  const submit = async e => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr('');
    const m = await setupAdmin({ code: v.code, name: v.name.trim(), email: v.email.trim(), password: v.password });
    setBusy(false);
    if (m) setErr(m);
  };
  return html`<div class="gate-screen">
    <form class="gate-card" onSubmit=${submit}>
      <span class="brand-mark big"><${FxMark} size=${34} /></span>
      <h1>Create the admin account</h1>
      <p class="soft">The desk now uses personal logins. Create the first admin account, then add your team in Team & access.</p>
      <label class="field"><span>Setup code <span class="hint">the old team passcode</span></span>
        <input id="setup-code" class="input" type="password" autocomplete="off" data-autofocus autofocus value=${v.code} onInput=${set('code')} /></label>
      <label class="field"><span>Your name</span><input id="setup-name" class="input" autocomplete="name" value=${v.name} onInput=${set('name')} /></label>
      <label class="field"><span>Email</span><input id="setup-email" class="input" type="email" autocomplete="username" value=${v.email} onInput=${set('email')} /></label>
      <label class="field"><span>Password <span class="hint">at least 8 characters</span></span><input id="setup-password" class="input" type="password" autocomplete="new-password" value=${v.password} onInput=${set('password')} /></label>
      <label class="field"><span>Repeat password</span><input id="setup-confirm" class="input" type="password" autocomplete="new-password" value=${v.confirm} onInput=${set('confirm')} /></label>
      ${v.confirm && v.password !== v.confirm && html`<div class="note-box warn">The passwords don't match.</div>`}
      ${err && html`<div class="note-box bad">${err}</div>`}
      <button type="submit" class="btn primary" disabled=${busy || !ok}>${busy ? 'Creating…' : 'Create admin account'}</button>
    </form>
  </div>`;
}
function OfflineScreen() {
  return html`<div class="gate-screen"><div class="gate-card">
    <span class="brand-mark big"><${FxMark} size=${34} /></span>
    <h1>Can't reach the desk</h1>
    <p class="soft">The shared workspace isn't answering. Check your internet connection, then try again.</p>
    <button type="button" class="btn primary" onClick=${() => location.reload()}>Try again</button>
  </div></div>`;
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
  const sc = UI.scope && rawData().clients[UI.scope];
  if (sc) {
    out.push(html`<div class=${'scope-bar c' + (((sc.colorIdx | 0) % CLIENT_COLORS + CLIENT_COLORS) % CLIENT_COLORS)} key="scope">
      <span class="scope-dot"></span>
      <p><strong>${sc.name}</strong> workspace · you're seeing only ${sc.name}'s prospects, tasks, sequences, activity and reports.</p>
      <button type="button" class="btn sm" onClick=${() => UI.setScope('')}>Show all clients</button></div>`);
  }
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
    out.push(html`<div class="banner ro" key="ro"><${Icon} n="info" /><p><strong>View only.</strong> ${Store.user ? 'Your role is Viewer. Ask an admin if you need to log activity.' : 'Ask the owner for edit access to log activity here.'}</p></div>`);
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
  const linkTried = useRef(false);
  useLayoutEffect(() => {
    const f = () => { seen.current = Store.ver; force(n => n + 1); };
    Store.listeners.add(f);
    if (Store.ver !== seen.current) f();
    return () => { Store.listeners.delete(f); };
  }, []);
  const data = currentData();
  const loading = !Store.real || !Store.real.ready() || !Store.decided;
  useEffect(() => {
    if (!loading && UI.scope && Store.real && Store.real.ready() && !rawData().clients[UI.scope]) UI.setScope('');
  }, [loading, data]);
  const board = useMemo(() => (loading ? null : buildBoard(data, { today: TODAY })), [data, TODAY, loading]);
  useEffect(() => { if (!loading && Store.user && Store.user.mustChange && !UI.modal) UI.open('password', {}); }, [loading, Store.user && Store.user.mustChange]);
  /* An admin without a team-list entry (e.g. the first admin) gets one, so their activity is signed with their name. */
  useEffect(() => {
    const u = Store.user;
    if (loading || !u || u.memberId || u.role !== 'admin' || linkTried.current) return;
    linkTried.current = true;
    (async () => {
      const team = rawData().settings.team || [];
      const m = team.find(x => x.name.toLowerCase() === u.name.toLowerCase()) || await addPerson(u.name, ['manager', 'operator']);
      if (!m) return;
      const r = await api('PUT', 'users/' + u.id, { memberId: m.id });
      if (r.ok) { u.memberId = m.id; pref('me', m.id); UI.set({ me: m.id }); }
    })();
  }, [loading, Store.user]);
  const counts = board ? board.counts : { open: 0 };
  let view;
  if (Store.mode === 'gate') return html`<div><${Gate} /><${Toasts} /></div>`;
  if (Store.mode === 'setup') return html`<div><${SetupScreen} /><${Toasts} /></div>`;
  if (Store.mode === 'offline') return html`<div><${OfflineScreen} /><${Toasts} /></div>`;
  if (loading) {
    view = html`<div class="boot"><div><div class="spinner"></div>${Store.mode === 'boot' ? 'Connecting…' : 'Loading your workspace…'}</div></div>`;
  } else if (UI.view === 'prospects') view = html`<${ProspectsView} />`;
  else if (UI.view === 'clients') view = html`<${ClientsView} />`;
  else if (UI.view === 'sequences') view = html`<${SequencesView} />`;
  else if (UI.view === 'activity') view = html`<${ActivityView} />`;
  else if (UI.view === 'reports') view = html`<${ReportsView} />`;
  else if (UI.view === 'settings') view = html`<${SettingsView} />`;
  else if (UI.view === 'users') view = html`<${UsersView} />`;
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
  if (UI.scope) UI.setScope(UI.scope, true);
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
