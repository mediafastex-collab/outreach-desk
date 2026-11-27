/* Fastex Outreach Desk — ui.js
   Shared UI state and building blocks: icons, pills, menus, modals, toasts, copy and save helpers. */
'use strict';

const { html, render, useState, useEffect, useLayoutEffect, useMemo, useRef, useErrorBoundary } = htmPreact;
let modalCounter = 0;

let TODAY = todayISO();
setInterval(() => { const n = todayISO(); if (n !== TODAY) { TODAY = n; bump(); } }, 30000);

const UI = {
  view: 'today',
  drawer: null,
  modal: null,
  toasts: [],
  todayFilter: { clientId: '', operatorId: '', group: 'all', listId: '', q: '' },
  prospectFilter: { q: '', clientId: '', senderId: '', status: '', sequenceId: '', tag: '', sort: 'next', listId: '', potential: '', country: '', needs: false },
  activityFilter: { period: '7d', from: '', to: '', clientId: '', listId: '', memberId: '', kind: '', q: '' },
  seqScope: '',
  reportFilter: { clientId: '', listId: '', period: 'month', from: '', to: '' },
  /* Shared by Today, Focus run and Prospects: only people added in this period. */
  addedFilter: { period: 'all', from: '', to: '' },
  seqSelected: null,
  me: pref('me') || '',
  scope: pref('scope') || '',
  /* Workspace switcher: '' = all clients, or one client id. Every screen follows. */
  setScope(id, quiet) {
    const c = id || '';
    this.scope = c;
    pref('scope', c || null);
    this.todayFilter = Object.assign({}, this.todayFilter, { clientId: c, listId: '' });
    this.prospectFilter = Object.assign({}, this.prospectFilter, { clientId: c, listId: '', senderId: '', status: '' });
    this.reportFilter = Object.assign({}, this.reportFilter, { clientId: c });
    this.activityFilter = Object.assign({}, this.activityFilter, { clientId: c, listId: '' });
    this.seqScope = ''; this.seqSelected = null; this.drawer = null;
    if (!quiet) bump();
  },
  set(patch) { Object.assign(this, patch); bump(); },
  go(view, patch) {
    Object.assign(this, patch || {}, { view });
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* hash not allowed here */ }
    pref('view', view);
    bump();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  },
  open(type, props) {
    if (!modalAllowed(type, props || {})) { noPermission(); return; }
    this.modal = { type, props: props || {}, n: ++modalCounter }; bump();
  },
  close() { this.modal = null; bump(); },
  openProspect(p) { this.drawer = { cid: p.clientId, pid: p.id }; bump(); },
  closeDrawer() { this.drawer = null; bump(); },
  toast(text, opts) {
    const id = uid('t');
    const t = Object.assign({ id, text }, opts || {});
    this.toasts = this.toasts.concat(t).slice(-3);
    bump();
    setTimeout(() => this.dismiss(id), t.action ? 12000 : t.undo ? 8000 : 4000);
  },
  dismiss(id) { const n = this.toasts.filter(t => t.id !== id); if (n.length !== this.toasts.length) { this.toasts = n; bump(); } },
};

/* ---------- icons (24px stroke set) ---------- */
const ICONS = {
  today: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  reply: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  thumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  checkSquare: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  chevDown: '<polyline points="6 9 12 15 18 9"/>',
  chevRight: '<polyline points="9 18 15 12 9 6"/>',
  chevLeft: '<polyline points="15 18 9 12 15 6"/>',
  up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
};
function Icon({ n, s }) {
  const size = s || 16;
  return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[n] || '' }}></svg>`;
}
const GROUP_ICON = { reply: 'reply', message: 'message', invite: 'userPlus', touch: 'eye', reminder: 'bell', pending: 'clock' };
const GROUP_TONE = { reply: 'tone-reply', message: 'tone-accent', invite: 'tone-info', touch: 'tone-neutral', reminder: 'tone-today', pending: 'tone-info' };

/* ---------- small pieces ---------- */
function StatusPill({ status }) {
  const st = STATUSES[status] || { label: status || 'Unknown', tone: 'neutral' };
  return html`<span class=${'pill tone-' + st.tone}><span class="dot"></span>${st.label}</span>`;
}
function ClientChip({ client }) {
  if (!client) return html`<span class="chip c7">Unknown client</span>`;
  return html`<span class=${'chip c' + (((client.colorIdx | 0) % CLIENT_COLORS + CLIENT_COLORS) % CLIENT_COLORS)} title=${client.name}>${client.name}</span>`;
}
function memberName(settings, id) {
  const m = (settings.team || []).find(x => x.id === id);
  return m ? m.name : '';
}
function Due({ due, today, time }) {
  const d = dueInfo(due, today || TODAY, time);
  return html`<span class=${'pill tone-' + d.tone}>${d.text}</span>`;
}
function Empty({ icon, title, children, action }) {
  return html`<div class="empty">
    ${icon && html`<${Icon} n=${icon} s=${28} />`}
    <h3>${title}</h3>
    ${children && html`<p>${children}</p>`}
    ${action}
  </div>`;
}
function Chars({ text, connect }) {
  const n = String(text || '').length;
  if (!connect) return html`<span class="chars">${n} chars</span>`;
  const cls = n > 300 ? 'chars over' : n > 200 ? 'chars warn' : 'chars';
  return html`<span class=${cls} title="LinkedIn allows 300 characters on connection notes (200 on free accounts)">${n}/300${n > 200 && n <= 300 ? ' · over the free-account 200' : ''}</span>`;
}
/* Renders filled template text with missing variables highlighted. */
function MsgText({ text }) {
  const parts = String(text || '').split(/(\[[^\]\n]{1,80}\]|\{\{\s*[a-zA-Z]+\s*\}\})/g);
  return parts.map((s, i) => i % 2 === 1 ? html`<span class="miss" key=${i}>${s}</span>` : s);
}
/* Unfilled [placeholders] left in a template. */
function placeholders(text) { return (String(text || '').match(/\[[^\]\n]{1,80}\]/g) || []).length; }

/* ---------- clipboard & files ---------- */
function copyText(text, label) {
  const done = () => UI.toast((label || 'Copied') + ' to clipboard.');
  const fallback = () => UI.open('text', { title: 'Copy this text', text });
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
      return;
    }
  } catch (e) { /* fall through */ }
  fallback();
}
async function saveFile(filename, data) {
  const dl = await capability('downloads');
  if (dl) {
    try { await dl.save({ filename, data }); UI.toast('Saved ' + filename + '.'); }
    catch (e) { if (errCode(e) !== 'declined') UI.toast('Could not save the file here. Use Copy instead.', { bad: true }); }
    return;
  }
  if (window.top === window) {
    try {
      const blob = new Blob([data], { type: filename.endsWith('.json') ? 'application/json' : 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return;
    } catch (e) { /* fall through */ }
  }
  UI.open('text', { title: filename, text: data, sub: 'Downloads are not available here. Copy the contents instead.' });
}
/* The Fastex Media "FX" mark (from brandkit.fastexmedia.com): ink letters, orange chevron. */
function FxMark({ size }) {
  const h = size || 24;
  return html`<svg class="fx-mark" viewBox="138 155 338 306" width=${Math.round(h * 338 / 306)} height=${h} aria-hidden="true">
    <path fill="currentColor" d="M138 241H261.33L290.67 285H138ZM138 330H291.33L262 374H181V461H138Z" />
    <path fill="currentColor" d="M416 155H476L380.5 298.25L350.5 253.25ZM416 461H476L380.5 317.75L350.5 362.75Z" />
    <path fill="#FF6600" d="M204 155H264L366 308L264 461H204L306 308Z" /></svg>`;
}

/* ---------- roles and permissions (enforced again on the server) ---------- */
const ROLE_INFO = {
  admin: { label: 'Admin', desc: 'Everything, including users & access and workspace settings.' },
  manager: { label: 'Manager', desc: 'Clients, sequences, lists, imports and deleting prospects.' },
  member: { label: 'Member', desc: 'Works Today and Focus run, adds and edits prospects, logs activity. Can\'t delete.' },
  viewer: { label: 'Viewer', desc: 'Read only: sees prospects, activity and reports.' },
};
const ROLE_RANK = { viewer: 0, member: 1, manager: 2, admin: 3 };
/* What the signed-in user may do. Without sign-in (local development) everything is allowed. */
function can(perm, clientId) {
  const u = Store.user;
  if (!u) return true;
  const rank = ROLE_RANK[u.role] || 0;
  const allClients = u.role === 'admin' || !u.clients;
  const hasClient = !clientId || allClients || u.clients.indexOf(clientId) !== -1;
  switch (perm) {
    case 'users': case 'settings': return u.role === 'admin';
    case 'newClient': return rank >= 2 && allClients;
    case 'clients': case 'sequences': case 'delete': return rank >= 2 && hasClient;
    case 'write': return rank >= 1 && hasClient;
    default: return false;
  }
}
/* Windows that change things, checked before they open (the server checks every save too). */
function modalAllowed(type, p) {
  switch (type) {
    case 'client': return p.id ? can('clients', p.id) : can('newClient');
    case 'newSeq': return can('sequences', p.clientId || null);
    case 'people': case 'importFile': case 'user': return can('settings');
    case 'lists': return can('clients', p.clientId);
    case 'bulk': case 'addProspect': return can('write', p.clientId || null);
    case 'changeSeq': case 'setList': return can('write');
    default: return true;
  }
}
const noPermission = () => UI.toast('Your role doesn\'t allow that. Ask an admin if you need it.', { bad: true });

function PasswordModal() {
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setV(Object.assign({}, v, { [k]: e.target.value }));
  const ok = v.current && v.next.length >= 8 && v.next === v.confirm;
  const submit = async e => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr('');
    const r = await api('POST', 'auth/password', { current: v.current, next: v.next });
    setBusy(false);
    if (!r.ok) { setErr(authError(r)); return; }
    if (Store.user) Store.user.mustChange = false;
    UI.close();
    UI.toast('Password changed. Other browsers signed in as you were signed out.');
  };
  const forced = Store.user && Store.user.mustChange;
  return html`<${Modal} title=${forced ? 'Choose your own password' : 'Change password'} sub=${forced ? 'Your admin set a temporary password. Pick one only you know.' : ''} size="narrow" foot=${html`
      ${!forced && html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>`}
      <button type="submit" form="pw-form" class="btn primary" disabled=${busy || !ok}>${busy ? 'Saving…' : 'Change password'}</button>`}>
    <form id="pw-form" class="stack" onSubmit=${submit}>
      <label class="field"><span>${forced ? 'Temporary password' : 'Current password'}</span><input id="pw-current" class="input" type="password" autocomplete="current-password" data-autofocus value=${v.current} onInput=${set('current')} /></label>
      <label class="field"><span>New password <span class="hint">at least 8 characters</span></span><input id="pw-next" class="input" type="password" autocomplete="new-password" value=${v.next} onInput=${set('next')} /></label>
      <label class="field"><span>Repeat new password</span><input id="pw-confirm" class="input" type="password" autocomplete="new-password" value=${v.confirm} onInput=${set('confirm')} /></label>
      ${v.confirm && v.next !== v.confirm && html`<div class="note-box warn">The new passwords don't match.</div>`}
      ${err && html`<div class="note-box bad">${err}</div>`}
    </form>
  <//>`;
}

/* Search box used across the desk. */
function SearchBox({ id, value, onInput, placeholder, grow }) {
  return html`<label class=${'search' + (grow ? ' grow' : '')} style=${grow ? undefined : 'min-width:220px'}><${Icon} n="search" s=${15} /><span class="sr">${placeholder || 'Search'}</span>
    <input id=${id} class="input" type="search" placeholder=${placeholder || 'Search…'} value=${value || ''} onInput=${e => onInput(e.target.value)} /></label>`;
}
const needleOf = q => String(q || '').trim().toLowerCase();

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/* ---------- Excel (.xlsx) reading, no library: unzip with the browser, read the first sheet's XML ---------- */
async function unzipEntries(buf) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not an .xlsx file');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out[name] = { method, size, local };
    p += 46 + nameLen + extraLen + commentLen;
  }
  out.read = async name => {
    const e = out[name];
    if (!e) return null;
    const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
    const raw = new Uint8Array(buf, start, e.size);
    if (e.method === 0) return dec.decode(raw);
    if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('unsupported compression');
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  };
  return out;
}
async function readXlsxRows(file) {
  const z = await unzipEntries(await file.arrayBuffer());
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));
  const text = el => kids(el, 't').map(t => t.textContent).join('');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await z.read('xl/workbook.xml'), rels = await z.read('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = kids(xml(wb), 'sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = kids(xml(rels), 'Relationship').find(r => r.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); sheetPath = t.startsWith('xl/') ? t : 'xl/' + t; }
  }
  const sst = await z.read('xl/sharedStrings.xml');
  const shared = sst ? kids(xml(sst), 'si').map(text) : [];
  const sheet = await z.read(sheetPath);
  if (!sheet) throw new Error('no sheet found');
  const colIdx = ref => { let n = 0; for (const ch of String(ref).replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const row of kids(xml(sheet), 'row')) {
    const r = [];
    for (const c of kids(row, 'c')) {
      const t = c.getAttribute('t'), vEl = kids(c, 'v')[0];
      let val = '';
      if (t === 's') val = shared[parseInt(vEl ? vEl.textContent : '', 10)] || '';
      else if (t === 'inlineStr') val = text(c);
      else if (t === 'b') val = vEl && vEl.textContent === '1' ? 'TRUE' : 'FALSE';
      else val = vEl ? vEl.textContent : '';
      const i = c.getAttribute('r') ? colIdx(c.getAttribute('r')) : r.length;
      while (r.length < i) r.push('');
      r[i] = val;
    }
    rows.push(r);
  }
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map(r => r.concat(Array(w - r.length).fill('')));
}

/* ---------- menu (fixed-position dropdown) ---------- */
function Menu({ label, icon, items, btnClass, title }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);
  const toggle = e => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btn.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const style = { right: Math.max(8, window.innerWidth - r.right) + 'px' };
    /* Open on the side with more room and let the menu use all of it, so long menus aren't cut off. */
    const up = below < 280 && r.top > below;
    if (up) style.bottom = (window.innerHeight - r.top + 4) + 'px';
    else style.top = (r.bottom + 4) + 'px';
    style.maxHeight = Math.max(160, (up ? r.top : below) - 16) + 'px';
    setPos(style);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const inside = t => (menu.current && menu.current.contains(t)) || (btn.current && btn.current.contains(t));
    const onDown = e => { if (!inside(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = e => { if (!(e.target instanceof Node) || !inside(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    const first = menu.current && menu.current.querySelector('button:not([disabled])');
    if (first) first.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);
  const list = (items || []).filter(Boolean);
  return html`<span class="menu-anchor">
    <button ref=${btn} type="button" class=${btnClass || 'btn sm icon'} aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'} title=${title || label || 'More actions'} aria-label=${label ? undefined : (title || 'More actions')} onClick=${toggle}>
      ${icon && html`<${Icon} n=${icon} />`}${label}${label && html`<${Icon} n="chevDown" s=${14} />`}
    </button>
    ${open && html`<div class="menu" role="menu" ref=${menu} style=${pos}>
      ${list.map((it, i) => it.divider ? html`<hr key=${'d' + i} />`
        : it.header ? html`<div class="mh" key=${'h' + i}>${it.header}</div>`
        : html`<button key=${'b' + i} type="button" role="menuitem" class=${it.danger ? 'danger' : ''} disabled=${!!it.disabled}
            onClick=${() => { setOpen(false); it.onSelect(); }}>${it.dot != null && html`<span class=${'swatch-dot c' + (((it.dot | 0) % CLIENT_COLORS + CLIENT_COLORS) % CLIENT_COLORS)} style="background:currentColor;width:10px;height:10px;border-radius:3px;flex:none"></span>`}${it.icon && html`<${Icon} n=${it.icon} />`}<span style="flex:1">${it.label}</span>${it.meta && html`<span class="mono muted" style="font-size:11.5px">${it.meta}</span>`}${it.checked && html`<${Icon} n="check" s=${14} />`}</button>`)}
    </div>`}
  </span>`;
}

/* ---------- modal shell ---------- */
function Modal({ title, sub, children, foot, onClose, size }) {
  const close = onClose || (() => UI.close());
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current && ref.current.querySelector('[data-autofocus]');
    if (el) setTimeout(() => { try { el.focus(); } catch (e) { /* ignore */ } }, 40);
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return html`<div class="modal-wrap" role="dialog" aria-modal="true" aria-label=${title}>
    <div class="scrim" onClick=${close}></div>
    <div class=${'modal ' + (size || '')} ref=${ref}>
      <div class="modal-head">
        <div><h2>${title}</h2>${sub && html`<p>${sub}</p>`}</div>
        <button type="button" class="btn ghost icon" aria-label="Close" onClick=${close}><${Icon} n="x" /></button>
      </div>
      <div class="modal-body">${children}</div>
      ${foot && html`<div class="modal-foot">${foot}</div>`}
    </div>
  </div>`;
}

function ConfirmModal({ title, body, confirmLabel, cancelLabel, danger, typed, onConfirm }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !typed || val.trim().toUpperCase() === typed.toUpperCase();
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); UI.close(); } };
  return html`<${Modal} title=${title} size="narrow" foot=${html`
      <button type="button" class="btn" onClick=${() => UI.close()}>${cancelLabel || 'Cancel'}</button>
      <button type="button" class=${'btn ' + (danger ? 'danger solid' : 'primary')} disabled=${!ok || busy} onClick=${go}>${busy ? 'Working…' : confirmLabel || 'Confirm'}</button>`}>
    <p class="soft">${body}</p>
    ${typed && html`<label class="field"><span>Type ${typed} to confirm</span><input id="confirm-typed" class="input" data-autofocus value=${val} onInput=${e => setVal(e.target.value)} /></label>`}
  <//>`;
}

/* Date filter dropdown: Today, Last 7 / 15 days, This month, Last month, Custom dates, All time. */
function PeriodFilter({ id, value, onChange, prefix, allLabel, title }) {
  const v = value || { period: 'all' };
  const r = periodRange(v.period, TODAY, v);
  const name = k => (k === 'all' && allLabel) || (PERIOD_OPTIONS.find(o => o[0] === k) || [k, k])[1];
  const cur = v.period === 'custom' ? r.label : name(v.period);
  const items = PERIOD_OPTIONS.map(([k]) => k === 'custom'
    ? { label: name(k), icon: 'calendar', checked: v.period === 'custom', meta: v.period === 'custom' ? r.label : '',
        onSelect: () => UI.open('range', { title: (prefix ? prefix + ': ' : '') + 'custom dates', from: v.period === 'custom' ? r.from : addDays(TODAY, -6), to: v.period === 'custom' ? r.to : TODAY,
          onApply: (from, to) => onChange({ period: 'custom', from, to }) }) }
    : { label: name(k), checked: v.period === k, meta: k === 'all' ? '' : periodRange(k, TODAY).from ? fmtShort(periodRange(k, TODAY).from) + (k === 'today' ? '' : ' – ' + fmtShort(periodRange(k, TODAY).to)) : '',
        onSelect: () => onChange({ period: k, from: '', to: '' }) });
  items.splice(items.length - 1, 0, { divider: true });
  return html`<span id=${id} class="period-filter"><${Menu} label=${(prefix ? prefix + ': ' : '') + cur} icon="calendar" btnClass=${'btn sm' + (v.period !== 'all' ? ' filter-on' : '')} title=${title || 'Date filter'} items=${items} /></span>`;
}

/* "in the last 7 days", "this month", "on 3 Oct", "between 1 Oct and 9 Oct" */
function addedText(f, r) {
  if (!r) return 'any time';
  if (f.period === 'today') return 'today';
  if (f.period === 'month') return 'this month';
  if (f.period === 'lastmonth') return 'in ' + r.label;
  if (f.period === '7d' || f.period === '15d') return 'in the ' + r.label.toLowerCase();
  if (r.from && r.from === r.to) return 'on ' + fmtShort(r.from);
  return r.from ? 'between ' + fmtShort(r.from) + ' and ' + fmtShort(r.to) : 'up to ' + fmtShort(r.to);
}

function RangeModal({ title, sub, from, to, onApply }) {
  const [a, setA] = useState(from || addDays(TODAY, -6));
  const [b, setB] = useState(to || TODAY);
  const ok = isISODate(a) && isISODate(b) && a <= b;
  const submit = e => { e.preventDefault(); if (!ok) return; UI.close(); onApply(a, b); };
  return html`<${Modal} title=${title || 'Custom dates'} sub=${sub} size="narrow" foot=${html`
      <button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>
      <button type="submit" form="range-form" class="btn primary" disabled=${!ok}>Apply</button>`}>
    <form id="range-form" class="stack" onSubmit=${submit}>
      <div class="fields">
        <label class="field"><span>From</span><input id="range-from" type="date" class="input" value=${a} max=${b || undefined} onInput=${e => setA(e.target.value)} /></label>
        <label class="field"><span>To</span><input id="range-to" type="date" class="input" value=${b} min=${a || undefined} onInput=${e => setB(e.target.value)} /></label>
      </div>
      ${isISODate(a) && isISODate(b) && a > b && html`<div class="note-box warn">The start date is after the end date.</div>`}
      ${ok && html`<p class="muted" style="font-size:12.5px">${fmtLong(a)} to ${fmtLong(b)} · ${plural(daysBetween(a, b) + 1, 'day')}</p>`}
    </form>
  <//>`;
}

function DateModal({ title, sub, presets, initial, initialTime, withNote, noteLabel, notePlaceholder, confirmLabel, onConfirm, withTime, timeLabel }) {
  const [date, setDate] = useState(initial || TODAY);
  const [time, setTime] = useState(initialTime || '');
  const [note, setNote] = useState('');
  const list = presets || [{ label: 'Today', value: TODAY }, { label: 'Yesterday', value: addDays(TODAY, -1) }];
  const submit = e => { e.preventDefault(); if (!isISODate(date)) return; UI.close(); onConfirm(date, note.trim(), isClock(time) ? time : ''); };
  return html`<${Modal} title=${title} sub=${sub} size="narrow" foot=${html`
      <button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>
      <button type="submit" form="date-form" class="btn primary" disabled=${!isISODate(date)}>${confirmLabel || 'Save'}</button>`}>
    <form id="date-form" class="stack" onSubmit=${submit}>
      <div class="seg" role="group" aria-label="Quick dates">
        ${list.map(p => html`<button type="button" key=${p.label} aria-pressed=${date === p.value ? 'true' : 'false'} onClick=${() => setDate(p.value)}>${p.label}</button>`)}
      </div>
      <div class="fields">
        <label class=${'field' + (withTime ? '' : ' full')}><span>Date</span><input id="date-input" type="date" class="input" value=${date} onInput=${e => setDate(e.target.value)} /></label>
        ${withTime && html`<label class="field"><span>${timeLabel || 'Time (optional)'}</span><input id="date-time" type="time" class="input" value=${time} onInput=${e => setTime(e.target.value)} /></label>`}
      </div>
      ${withTime && html`<div class="seg" role="group" aria-label="Quick times">
        ${['09:00', '11:00', '14:00', '16:30'].map(t => html`<button type="button" key=${t} aria-pressed=${time === t ? 'true' : 'false'} onClick=${() => setTime(time === t ? '' : t)}>${fmtClock(t)}</button>`)}
      </div>`}
      ${withNote && html`<label class="field"><span>${noteLabel || 'Note'}</span><textarea id="date-note" class="textarea" style="min-height:70px" placeholder=${notePlaceholder || ''} value=${note} onInput=${e => setNote(e.target.value)}></textarea></label>`}
    </form>
  <//>`;
}

function TextModal({ title, sub, text }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  return html`<${Modal} title=${title} sub=${sub || 'Select all and copy.'} foot=${html`<button type="button" class="btn primary" onClick=${() => UI.close()}>Done</button>`}>
    <textarea id="copy-text" ref=${ref} class="textarea" style="min-height:220px;font-family:var(--font-mono);font-size:12.5px" readonly value=${text}></textarea>
  <//>`;
}

function Toasts() {
  return html`<div class="toasts" aria-live="polite">
    ${UI.toasts.map(t => html`<div class=${'toast' + (t.bad ? ' bad' : '')} key=${t.id}>
      <p>${t.text}</p>
      ${t.action && html`<button type="button" class="toast-go" onClick=${() => { UI.dismiss(t.id); t.action.run(); }}>${t.action.label}</button>`}
      ${t.undo && html`<button type="button" onClick=${() => { UI.dismiss(t.id); t.undo(); }}>Undo</button>`}
      <button type="button" class="toast-x" aria-label="Dismiss" onClick=${() => UI.dismiss(t.id)}><${Icon} n="x" s=${14} /></button>
    </div>`)}
  </div>`;
}

/* ---------- selects ---------- */
function ClientSelect({ value, onChange, data, all, allLabel, id, cls, includeInactive }) {
  const list = Object.values(data.clients).filter(c => includeInactive || c.status !== 'archived').sort((a, b) => byText(a.name, b.name));
  return html`<select id=${id} class=${cls || 'select'} value=${value} onChange=${e => onChange(e.target.value)}>
    ${all && html`<option value="" selected=${!value}>${allLabel || 'All clients'}</option>`}
    ${list.map(c => html`<option key=${c.id} value=${c.id} selected=${value === c.id}>${c.name}${c.status === 'paused' ? ' (paused)' : c.status === 'archived' ? ' (archived)' : ''}</option>`)}
  </select>`;
}
/* People master. Roles: 'manager' (account manager of clients), 'operator' (runs LinkedIn accounts).
   Older entries without roles count as both. */
const ROLE_LABELS = { manager: 'Account manager', operator: 'Runs LinkedIn accounts' };
function hasRole(m, role) { return !role || !Array.isArray(m.roles) || m.roles.indexOf(role) !== -1; }
function peopleWith(settings, role) { return (settings.team || []).filter(m => hasRole(m, role)).sort((a, b) => byText(a.name, b.name)); }
function MemberSelect({ value, onChange, settings, all, allLabel, noneLabel, id, cls, role, allowNew }) {
  const list = peopleWith(settings, role);
  const current = value && !list.some(m => m.id === value) ? (settings.team || []).find(m => m.id === value) : null;
  return html`<select id=${id} class=${cls || 'select'} value=${value || ''} onChange=${e => onChange(e.target.value)}>
    ${all ? html`<option value="" selected=${!value}>${allLabel || 'Everyone'}</option>` : html`<option value="" selected=${!value}>${noneLabel || 'Not assigned'}</option>`}
    ${list.map(m => html`<option key=${m.id} value=${m.id} selected=${value === m.id}>${m.name}</option>`)}
    ${current && html`<option value=${current.id} selected=${true}>${current.name}</option>`}
    ${allowNew && html`<option value="__new">+ Add ${role === 'manager' ? 'account manager' : 'person'}…</option>`}
  </select>`;
}
/* Adds a person to the master and returns them. */
async function addPerson(name, roles) {
  const n = String(name || '').trim();
  if (!n || !W.guard()) return null;
  const s = currentData().settings;
  if ((s.team || []).some(m => m.name.toLowerCase() === n.toLowerCase())) { UI.toast(n + ' is already on the team.', { bad: true }); return (s.team || []).find(m => m.name.toLowerCase() === n.toLowerCase()); }
  const m = { id: uid('m'), name: n, roles: roles && roles.length ? roles : ['manager', 'operator'], createdAt: nowTs() };
  const ok = await W.saveSettings({ team: (s.team || []).concat(m) });
  return ok ? m : null;
}
function SequenceSelect({ value, onChange, data, clientId, id, cls, allowEmpty }) {
  const list = Object.values(data.seqs).filter(s => !s.archived && (!s.clientId || !clientId || s.clientId === clientId || s.id === value)).sort((a, b) => byText(a.name, b.name));
  const own = clientId ? list.filter(s => s.clientId === clientId) : [];
  const shared = list.filter(s => !s.clientId);
  const other = list.filter(s => s.clientId && s.clientId !== clientId);
  const opt = s => html`<option key=${s.id} value=${s.id} selected=${value === s.id}>${s.name}${!clientId && s.clientId && data.clients[s.clientId] ? ' · ' + data.clients[s.clientId].name : ''}</option>`;
  return html`<select id=${id} class=${cls || 'select'} value=${value || ''} onChange=${e => onChange(e.target.value)}>
    ${allowEmpty && html`<option value="" selected=${!value}>${allowEmpty}</option>`}
    ${own.length > 0 && html`<optgroup label=${'For ' + ((data.clients[clientId] || {}).name || 'this client')}>${own.map(opt)}</optgroup>`}
    ${own.length > 0 && shared.length > 0 ? html`<optgroup label="Shared templates">${shared.map(opt)}</optgroup>` : shared.map(opt)}
    ${other.map(opt)}
  </select>`;
}
function listsOf(data, clientId) { const c = data.clients[clientId]; return (c && Array.isArray(c.lists) ? c.lists : []).slice().sort((a, b) => byText(a.name, b.name)); }
function listName(data, clientId, listId) { const l = listsOf(data, clientId).find(x => x.id === listId); return l ? l.name : ''; }
/* Pick one list from any client (or only the given client's): "All lists", then each client's lists and "Not in a list". */
function ClientListSelect({ id, data, clientId, listId, onChange, cls }) {
  const clients = Object.values(data.clients).filter(c => c.status !== 'archived' && (c.lists || []).length && (!clientId || c.id === clientId)).sort((a, b) => byText(a.name, b.name));
  if (!clients.length) return null;
  const val = listId ? (clientId || '') + '|' + listId : '';
  return html`<select id=${id} class=${cls || 'select sm'} value=${val} aria-label="List" onChange=${e => { const v = e.target.value; if (!v) onChange(clientId || '', ''); else { const i = v.indexOf('|'); onChange(v.slice(0, i), v.slice(i + 1)); } }}>
    <option value="" selected=${!val}>All lists</option>
    ${clients.map(c => html`<optgroup key=${c.id} label=${c.name}>
      ${listsOf(data, c.id).map(l => html`<option key=${l.id} value=${c.id + '|' + l.id} selected=${val === c.id + '|' + l.id}>${l.name}</option>`)}
      <option value=${c.id + '|_none'} selected=${val === c.id + '|_none'}>Not in a list</option>
    </optgroup>`)}
  </select>`;
}
function listLabel(data, clientId, listId) { return listId === '_none' ? 'Not in a list' : (listName(data, clientId, listId) || 'List'); }

function ListSelect({ value, onChange, data, clientId, id, cls, allLabel, allowNew }) {
  const lists = listsOf(data, clientId);
  return html`<select id=${id} class=${cls || 'select'} value=${value || ''} onChange=${e => onChange(e.target.value)}>
    <option value="" selected=${!value}>${allLabel || 'No list'}</option>
    ${lists.map(l => html`<option key=${l.id} value=${l.id} selected=${value === l.id}>${l.name}</option>`)}
    ${allowNew && html`<option value="__new">+ New list…</option>`}
  </select>`;
}
/* Saves a new list on the client and returns it. */
/* Points the given lists at a sequence (and, with exclusive, unhooks the client's other lists from it),
   then offers to move people already in those lists onto it, keeping their progress. */
async function setListsSequence(clientId, seq, listIds, exclusive) {
  const data = currentData();
  const c = data.clients[clientId];
  if (!c || !W.guard()) return false;
  const want = new Set(listIds);
  const lists = (c.lists || []).map(l => want.has(l.id) ? Object.assign({}, l, { sequenceId: seq.id })
    : exclusive && l.sequenceId === seq.id ? Object.assign({}, l, { sequenceId: null }) : l);
  const ok = await W.saveClient(Object.assign(clone(c), { lists, updatedAt: nowTs() }));
  if (!ok) return false;
  const movers = data.prospects.filter(p => p.clientId === clientId && p.listId && want.has(p.listId) && p.sequenceId !== seq.id);
  if (movers.length) {
    const names = (c.lists || []).filter(l => want.has(l.id)).map(l => l.name).join(', ');
    UI.open('confirm', {
      title: 'Move ' + plural(movers.length, 'person', 'people') + ' to ' + seq.name + '?',
      body: names + ' now use' + (want.size === 1 ? 's' : '') + ' this sequence, and anyone added from now on starts on it. ' + plural(movers.length, 'person', 'people') + ' already in ' + (want.size === 1 ? 'the list are' : 'these lists are') + ' on another sequence. Move them too? They keep their progress: nobody is invited twice, and the next message is the next one in this sequence.',
      confirmLabel: 'Move them', cancelLabel: 'Only new people',
      onConfirm: () => moveToSequence(movers.map(fresh), seq),
    });
  }
  return true;
}

async function createList(clientId, name, sequenceId) {
  const c = currentData().clients[clientId];
  if (!c || !W.guard()) return null;
  const l = { id: uid('ls'), name: String(name || '').trim(), sequenceId: sequenceId || null, createdAt: nowTs() };
  if (!l.name) return null;
  const ok = await W.saveClient(Object.assign(clone(c), { lists: (c.lists || []).concat(l), updatedAt: nowTs() }));
  return ok ? l : null;
}

/* ---------- theme: always light ---------- */
pref('theme', null); /* forget the old light/dark/auto choice */

/* ---------- "Copy to Outreach Desk" bookmark (runs on a LinkedIn profile the user is viewing) ---------- */
const BOOKMARKLET_SRC = "(function(){var href=location.href;if(!/linkedin\\.com\\/(in|pub|sales\\/lead)\\//i.test(href)){alert('Open a LinkedIn profile first, then click this bookmark.');return;}" +
  "function t(el){return el?(el.innerText||el.textContent||'').replace(/\\s+/g,' ').trim():'';}" +
  "var main=document.querySelector('main')||document.body;" +
  "var name=t(main.querySelector('h1'))||(document.title.split('|')[0]||'').replace(/^\\(\\d+\\)\\s*/,'').trim();" +
  "var headline=t(main.querySelector('.text-body-medium'));" +
  "var loc=t(main.querySelector('span.text-body-small.inline'));" +
  "var company='';var cb=main.querySelector('[aria-label^=\"Current company\"]');" +
  "if(cb){company=(cb.getAttribute('aria-label')||'').replace(/^Current company:\\s*/i,'').replace(/\\.\\s*Click.*$/i,'').trim();}" +
  "var position='';var an=document.getElementById('experience');var sec=an?an.closest('section'):null;" +
  "if(sec){var li=sec.querySelector('li');if(li){var sp=function(n){return [].slice.call(n.querySelectorAll('span[aria-hidden=\"true\"]')).map(t).filter(Boolean);};var p=sp(li);" +
  "var first=(p[1]||'').split('\\u00b7')[0].trim();var grouped=!!li.querySelector('ul li')&&/^(full-time|part-time|contract|freelance|internship|self-employed|\\d+\\s*(yrs?|mos?))/i.test(first);" +
  "if(grouped){if(!company)company=p[0];var sub=li.querySelector('ul li');if(sub){var q=sp(sub);position=q[0]||'';}}" +
  "else{position=p[0]||'';if(!company&&p[1])company=p[1].split('\\u00b7')[0].trim();}}}" +
  "var out='FOD1:'+JSON.stringify({v:1,url:href.split('?')[0].split('#')[0],name:name,headline:headline,position:position,company:company,location:loc});" +
  "function ok(){alert('Copied '+(name||'this profile')+'. Now paste it into Outreach Desk.');}" +
  "function fb(){prompt('Copy this, then paste it into Outreach Desk:',out);}" +
  "try{navigator.clipboard.writeText(out).then(ok,fb);}catch(e){fb();}})();";
const BOOKMARKLET_HREF = 'javascript:' + encodeURIComponent(BOOKMARKLET_SRC);

function BookmarkletModal() {
  return html`<${Modal} title="One-click profile copy" sub="Copies a LinkedIn profile's name, headline, position, company and location so you don't type them." size="narrow"
    foot=${html`<button type="button" class="btn primary" onClick=${() => UI.close()}>Done</button>`}>
    <ol class="how-list">
      <li>Show your bookmarks bar (Chrome: <span class="mono">Cmd+Shift+B</span>, Windows: <span class="mono">Ctrl+Shift+B</span>).</li>
      <li>Drag this button onto the bookmarks bar:
        <div style="margin:10px 0"><a class="btn primary bm-link" href=${BOOKMARKLET_HREF} onClick=${e => { e.preventDefault(); UI.toast('Drag the button to your bookmarks bar. Clicking it here does nothing.'); }}><${Icon} n="copy" s=${14} />Copy to Outreach Desk</a></div></li>
      <li>Open someone's LinkedIn profile and click the bookmark. It copies their details.</li>
      <li>In the desk, click <strong>Paste from LinkedIn</strong> (Add prospect, a prospect's details, or Focus run) and paste.</li>
    </ol>
    <p class="note-box">It only reads the page you are already looking at, one profile per click, and sends nothing anywhere. If LinkedIn changes its page layout and a field comes out empty, select the top of the profile, copy it and paste that instead.</p>
  <//>`;
}

/* Paste box: understands the bookmark copy or text copied from the top of a profile. */
function ProfilePaste({ onApply, compact }) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseProfileText(text), [text]);
  const found = [['firstName', 'First name'], ['lastName', 'Last name'], ['position', 'Position'], ['company', 'Company'], ['title', 'Headline'], ['location', 'Location'], ['url', 'Profile URL']].filter(([k]) => parsed[k]);
  const apply = () => { if (!found.length) return; onApply(parsed); setText(''); if (compact) setOpen(false); UI.toast('Filled in ' + found.map(f => f[1].toLowerCase()).join(', ') + '. Check before saving.'); };
  if (!open) return html`<button type="button" class="btn sm" onClick=${() => setOpen(true)}><${Icon} n="copy" s=${14} />Paste from LinkedIn</button>`;
  return html`<div class="paste-box">
    <div class="paste-head"><strong><${Icon} n="copy" s=${14} />Paste from LinkedIn</strong>
      <button type="button" class="btn sm ghost" onClick=${() => UI.open('bookmarklet', {})}>Get the one-click bookmark</button>
      ${compact && html`<button type="button" class="btn sm ghost icon" aria-label="Close" onClick=${() => setOpen(false)}><${Icon} n="x" s=${14} /></button>`}</div>
    <textarea id=${'pp-' + (compact ? 'c' : 'f')} class="textarea" style="min-height:70px;font-size:12.5px" placeholder="Click the bookmark on their profile, or select the top of their profile (name down to location), copy and paste it here."
      value=${text} onInput=${e => setText(e.target.value)}></textarea>
    ${text && html`<div class="btn-row">
      ${found.length ? found.map(([k, l]) => html`<span class="pill tone-accent" key=${k}>${l}: ${String(parsed[k]).slice(0, 40)}</span>`) : html`<span class="pill tone-overdue">Couldn't read anything useful from that</span>`}
      <span style="flex:1"></span>
      <button type="button" class="btn sm primary" disabled=${!found.length} onClick=${apply}>Fill in</button>
    </div>`}
  </div>`;
}

/* ---------- human pacing between sends (per LinkedIn account) ---------- */
const Cool = { until: {}, timer: null };
function pacingSettings() {
  const s = currentData().settings;
  const min = Math.max(PACING_FLOOR, parseInt(s.pacingMin, 10) || PACING_FLOOR);
  const max = Math.max(min, parseInt(s.pacingMax, 10) || 20);
  return { on: s.pacingOn !== false, min, max };
}
function acctKeyOf(p) { return p.clientId + '|' + (p.senderId || 'none'); }
function cooldownLeft(key) { const u = Cool.until[key]; if (!u) return 0; const ms = u - Date.now(); return ms > 0 ? Math.ceil(ms / 1000) : 0; }
function cooldownTotal(key) { return Cool.until[key + ':len'] || 0; }
function startCooldown(key) {
  const ps = pacingSettings();
  if (!ps.on) return 0;
  const secs = ps.min + Math.floor(Math.random() * (ps.max - ps.min + 1));
  Cool.until[key] = Date.now() + secs * 1000;
  Cool.until[key + ':len'] = secs;
  if (!Cool.timer) {
    Cool.timer = setInterval(() => {
      const live = Object.keys(Cool.until).some(k => k.indexOf(':len') === -1 && Cool.until[k] > Date.now());
      bump();
      if (!live) { clearInterval(Cool.timer); Cool.timer = null; Cool.until = {}; }
    }, 1000);
  }
  bump();
  return secs;
}
function Countdown({ secs, total, label }) {
  const r = 9, c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, secs / total)) : 0;
  return html`<span class="countdown" title="A short random pause between sends keeps the account's activity human-paced">
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r=${r} fill="none" stroke="var(--today-soft)" stroke-width="3" />
      <circle cx="11" cy="11" r=${r} fill="none" stroke="var(--today)" stroke-width="3" stroke-dasharray=${c} stroke-dashoffset=${c * (1 - frac)} transform="rotate(-90 11 11)" stroke-linecap="round" /></svg>
    <span>${label || 'Next send in'} <b class="num">${secs}s</b></span></span>`;
}
