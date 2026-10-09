/* Fastex Outreach Desk — engine.js
   Pure logic: dates, LinkedIn URLs, sequences, the daily task queue, analytics and CSV.
   Nothing in this file touches the DOM or storage. */
'use strict';

/* ---------- basics ---------- */
function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function nowTs() { return new Date().toISOString(); }
function uid(prefix) {
  let s;
  try { const a = new Uint32Array(2); crypto.getRandomValues(a); s = a[0].toString(36) + a[1].toString(36); }
  catch (e) { s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
  return (prefix || 'id') + '_' + s.slice(0, 12);
}
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function prospectDocId(key) { return 'p' + hash53(String(key)).toString(36); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : null; }
function fmtPct(v) { return v == null ? '–' : v + '%'; }
function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }
function fullName(p) { return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Unnamed prospect'; }
function byText(a, b) { return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' }); }
function decodeSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

/* ---------- dates (local calendar days as YYYY-MM-DD) ---------- */
const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function pad2(n) { return String(n).padStart(2, '0'); }
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dateOf(iso) { const p = String(iso).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, 12); }
function todayISO() { return isoOf(new Date()); }
function addDays(iso, n) { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); }
function daysBetween(a, b) { return Math.round((dateOf(b) - dateOf(a)) / DAY_MS); }
function weekdayOf(iso) { return dateOf(iso).getDay(); }
function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function nextWorkday(iso, workDays) {
  if (!Array.isArray(workDays) || workDays.length === 0 || workDays.length >= 7) return iso;
  let d = iso;
  for (let i = 0; i < 7; i++) {
    if (workDays.indexOf(weekdayOf(d)) !== -1) return d;
    d = addDays(d, 1);
  }
  return iso;
}
function fmtDay(iso) {
  if (!iso) return '–';
  const d = dateOf(iso);
  const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + y;
}
function fmtShort(iso) { if (!iso) return '–'; const d = dateOf(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function fmtLong(iso) { const d = dateOf(iso); return WEEKDAYS_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); }
function relDay(iso, ref) {
  const n = daysBetween(ref, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n <= 6) return 'in ' + n + ' days';
  if (n < -1 && n >= -13) return (-n) + ' days ago';
  return fmtDay(iso);
}
function isClock(s) { return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s); }
function fmtClock(hhmm) {
  if (!isClock(hhmm)) return '';
  const d = new Date(2000, 0, 1, parseInt(hhmm.slice(0, 2), 10), parseInt(hhmm.slice(3), 10));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtTime(ts) { if (!ts) return ''; const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function nowClock() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
/* ISO timestamp for a local calendar day at a local clock time (now's time when none given). */
function tsOf(on, time) {
  const p = String(on).split('-').map(Number);
  const now = new Date();
  const h = isClock(time) ? parseInt(time.slice(0, 2), 10) : now.getHours();
  const m = isClock(time) ? parseInt(time.slice(3), 10) : now.getMinutes();
  return new Date(p[0], p[1] - 1, p[2], h, m, isClock(time) ? 0 : now.getSeconds()).toISOString();
}
function dueInfo(due, ref, time) {
  const n = daysBetween(ref, due);
  const at = isClock(time) ? fmtClock(time) : '';
  if (n < 0) return { tone: 'overdue', text: (n === -1 ? '1 day' : (-n) + ' days') + ' overdue', n };
  if (n === 0) {
    if (at && ref === todayISO() && time > nowClock()) return { tone: 'neutral', text: 'Today at ' + at, n, later: true };
    return { tone: 'today', text: at ? 'Due now · ' + at : 'Due today', n };
  }
  if (n === 1) return { tone: 'neutral', text: 'Tomorrow' + (at ? ' at ' + at : ''), n };
  return { tone: 'neutral', text: fmtDay(due) + (at ? ' · ' + at : ''), n };
}

/* ---------- domain constants ---------- */
const STEP_TYPES = {
  connect: { name: 'Connection request', short: 'Invite', verb: 'Send the connection request', icon: 'userPlus', group: 'invite', text: 'Connection note (optional)' },
  message: { name: 'Message', short: 'Message', verb: 'Send the message', icon: 'message', group: 'message', text: 'Message' },
  inmail: { name: 'InMail', short: 'InMail', verb: 'Send the InMail', icon: 'mail', group: 'message', text: 'InMail' },
  voice: { name: 'Voice note', short: 'Voice note', verb: 'Record a voice note', icon: 'mic', group: 'message', text: 'Talking points' },
  visit: { name: 'Profile visit', short: 'Visit', verb: 'Visit their profile', icon: 'eye', group: 'touch', text: 'Instructions (optional)' },
  engage: { name: 'Like or comment', short: 'Engage', verb: 'Like or comment on a recent post', icon: 'thumbsUp', group: 'touch', text: 'Comment idea (optional)' },
  follow: { name: 'Follow', short: 'Follow', verb: 'Follow their profile', icon: 'user', group: 'touch', text: 'Instructions (optional)' },
  task: { name: 'Custom task', short: 'Task', verb: 'Complete the task', icon: 'checkSquare', group: 'touch', text: 'Instructions' },
};
const STEP_TYPE_ORDER = ['connect', 'message', 'inmail', 'voice', 'visit', 'engage', 'follow', 'task'];
function groupOf(type) { return (STEP_TYPES[type] || STEP_TYPES.task).group; }

const STATUSES = {
  queued: { label: 'Not started', tone: 'neutral', open: true },
  invited: { label: 'Invite pending', tone: 'info', open: true },
  active: { label: 'In sequence', tone: 'accent', open: true },
  replied: { label: 'Replied', tone: 'reply', open: true },
  interested: { label: 'Interested', tone: 'good', open: true },
  nurture: { label: 'Follow up later', tone: 'today', open: true },
  paused: { label: 'Paused', tone: 'neutral', open: true },
  meeting: { label: 'Meeting booked', tone: 'good', open: false },
  not_interested: { label: 'Not interested', tone: 'muted', open: false },
  finished: { label: 'No reply', tone: 'muted', open: false },
  withdrawn: { label: 'Invite withdrawn', tone: 'muted', open: false },
};
const STATUS_ORDER = ['queued', 'invited', 'active', 'replied', 'interested', 'nurture', 'meeting', 'not_interested', 'finished', 'withdrawn', 'paused'];
const OUTCOMES = ['interested', 'meeting', 'nurture', 'not_interested'];

const DEFAULT_SETTINGS = { agencyName: 'Fastex', team: [], workDays: [1, 2, 3, 4, 5], staleDays: 21, reminderTime: '09:30', pacingOn: true, pacingMin: 5, pacingMax: 20 };
const PACING_FLOOR = 5;
const SENDER_DEFAULTS = { dailyInvites: 20, weeklyInvites: 100, dailyMessages: 50 };
const CLIENT_COLORS = 8;

const TEMPLATE_VARS = [
  ['firstName', 'First name'], ['lastName', 'Last name'], ['fullName', 'Full name'], ['company', 'Company'],
  ['position', 'Position'], ['title', 'Headline'], ['painPoint', 'Pain point'], ['country', 'Country'], ['location', 'Location'], ['senderFirstName', 'Sender first name'],
  ['senderName', 'Sender name'], ['clientName', 'Client'],
];

const LINKEDIN_LINKS = {
  connections: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
  sent: 'https://www.linkedin.com/mynetwork/invitation-manager/sent/',
  messages: 'https://www.linkedin.com/messaging/',
};

/* ---------- sequence presets ---------- */
const SEQUENCE_PRESETS = {
  standard: {
    name: 'Standard 4-step follow-up',
    description: 'Connection request, then four messages: on acceptance, +3, +5 and +7 days.',
    steps: [
      { type: 'connect', label: '', delayDays: 0, template: 'Hi {{firstName}}, I work with [ICP, e.g. B2B SaaS founders] on [topic]. Came across your profile and thought it made sense to connect.' },
      { type: 'message', label: 'Welcome', delayDays: 0, template: 'Thanks for connecting, {{firstName}}!\n\nQuick context on me: I help [ICP] [achieve outcome] without [common pain]. No pitch here. Curious how you are handling [problem area] at {{company}} right now?' },
      { type: 'message', label: 'Value', delayDays: 3, template: 'Hi {{firstName}}, thought this might be useful: we recently helped [similar company] [specific result].\n\nThe short version of what worked: [one or two lines]. Happy to share the full breakdown if it is relevant for {{company}}.' },
      { type: 'message', label: 'Soft ask', delayDays: 5, template: '{{firstName}}, would a 15-minute call next week be worth it? I would walk you through how [result] could look for {{company}}. If it is not a fit, I will tell you straight away.' },
      { type: 'message', label: 'Breakup', delayDays: 7, template: 'Hi {{firstName}}, I do not want to crowd your inbox, so this is my last note. If [problem] becomes a priority later, just reply here and I will pick it up.\n\nWishing you and the {{company}} team a great quarter.' },
    ],
  },
  warmup: {
    name: 'Warm-up, then 4 messages',
    description: 'Visit and engage before inviting. Usually lifts acceptance rates for senior buyers.',
    steps: [
      { type: 'visit', label: '', delayDays: 0, template: '' },
      { type: 'engage', label: '', delayDays: 1, template: 'Leave a genuine comment on a recent post (two sentences, no pitch).' },
      { type: 'connect', label: '', delayDays: 1, template: '' },
      { type: 'message', label: 'Welcome', delayDays: 0, template: 'Thanks for connecting, {{firstName}}! Enjoyed your recent post. Out of curiosity, how is {{company}} approaching [problem area] this year?' },
      { type: 'message', label: 'Value', delayDays: 3, template: 'Hi {{firstName}}, sharing something that might help: [insight, case study or resource]. Would you like the details?' },
      { type: 'message', label: 'Soft ask', delayDays: 5, template: '{{firstName}}, open to a quick 15-minute call next week to compare notes on [topic]?' },
      { type: 'message', label: 'Breakup', delayDays: 7, template: 'Hi {{firstName}}, I will leave it here for now. If [problem] comes up later, I am one message away.' },
    ],
  },
  short: {
    name: 'Short: 2 messages',
    description: 'For warm lists and event attendees. Invite, one message, one nudge.',
    steps: [
      { type: 'connect', label: '', delayDays: 0, template: 'Hi {{firstName}}, great to see you at [event]. Would love to connect.' },
      { type: 'message', label: 'Follow-up', delayDays: 1, template: 'Thanks for connecting, {{firstName}}. [One-line reason for reaching out]. Worth a quick chat?' },
      { type: 'message', label: 'Nudge', delayDays: 5, template: 'Hi {{firstName}}, just bumping this up in case it got buried. Happy to send details over here instead.' },
    ],
  },
  blank: {
    name: 'New sequence',
    description: '',
    steps: [
      { type: 'connect', label: '', delayDays: 0, template: '' },
      { type: 'message', label: '', delayDays: 0, template: 'Hi {{firstName}}, ' },
    ],
  },
};
function makeSequence(presetKey, overrides) {
  const p = SEQUENCE_PRESETS[presetKey] || SEQUENCE_PRESETS.blank;
  return Object.assign({
    name: p.name, description: p.description || '', clientId: null, archived: false,
    steps: p.steps.map(s => Object.assign({ id: uid('st') }, s)),
    createdAt: nowTs(), updatedAt: nowTs(),
  }, overrides || {}, { id: (overrides && overrides.id) || uid('seq') });
}

/* ---------- sequences ---------- */
function stepIndexOf(p, seq) {
  const steps = (seq && seq.steps) || [];
  if (p.stepId) {
    const i = steps.findIndex(s => s.id === p.stepId);
    if (i >= 0) return i;
  }
  const n = Number.isFinite(p.stepIndex) ? p.stepIndex : 0;
  return Math.max(0, Math.min(n, steps.length));
}
function connectIndex(seq) { return ((seq && seq.steps) || []).findIndex(s => s.type === 'connect'); }
function messageTotal(seq) { return ((seq && seq.steps) || []).filter(s => s.type === 'message').length; }
function messageNumber(seq, i) { let k = 0; for (let j = 0; j <= i; j++) if (seq.steps[j] && seq.steps[j].type === 'message') k++; return k; }
/* Short name used in logs and reports: "Connection request", "Message 2", "Profile visit". */
function stepShort(seq, i) {
  const s = seq && seq.steps[i];
  if (!s) return '';
  if (s.type === 'message') return 'Message ' + messageNumber(seq, i);
  return (STEP_TYPES[s.type] || STEP_TYPES.task).name;
}
/* Full name used on tasks: "Message 2 of 4 · Value". */
function stepTitle(seq, i) {
  const s = seq && seq.steps[i];
  if (!s) return '';
  const base = s.type === 'message' ? 'Message ' + messageNumber(seq, i) + ' of ' + messageTotal(seq) : (STEP_TYPES[s.type] || STEP_TYPES.task).name;
  return s.label ? base + ' · ' + s.label : base;
}
/* Offsets for the cadence ruler. Pre-invite steps count from the start date,
   later steps count from acceptance. */
function cadence(seq) {
  const out = [];
  let day = 0, gated = false, afterGate = 0;
  (seq.steps || []).forEach((s, i) => {
    const d = Math.max(0, parseInt(s.delayDays, 10) || 0);
    const prev = seq.steps[i - 1];
    if (prev && prev.type === 'connect') { gated = true; afterGate = d; out.push({ step: s, i, gateBefore: true, day: afterGate, fromAccept: true }); return; }
    if (gated) { afterGate += d; out.push({ step: s, i, day: afterGate, fromAccept: true }); return; }
    day = i === 0 ? d : day + d;
    out.push({ step: s, i, day, fromAccept: false });
  });
  return out;
}
function validateSequence(seq) {
  const issues = [];
  const steps = seq.steps || [];
  if (!String(seq.name || '').trim()) issues.push({ level: 'bad', text: 'Give the sequence a name.' });
  if (!steps.length) issues.push({ level: 'bad', text: 'Add at least one step.' });
  const connects = steps.filter(s => s.type === 'connect').length;
  if (connects > 1) issues.push({ level: 'bad', text: 'Use only one connection request per sequence.' });
  const c = connectIndex(seq);
  if (c > 0 && steps.slice(0, c).some(s => s.type === 'message')) issues.push({ level: 'warn', text: 'A plain message before the connection request only works if you are already connected. Use InMail for strangers.' });
  steps.forEach((s, i) => {
    if (s.type === 'connect' && (s.template || '').length > 300) issues.push({ level: 'bad', text: 'Connection notes are capped at 300 characters by LinkedIn (step ' + (i + 1) + ').' });
    if ((parseInt(s.delayDays, 10) || 0) > 60) issues.push({ level: 'warn', text: 'Step ' + (i + 1) + ' waits more than 60 days.' });
  });
  const mids = steps.filter((s, i) => i > 0 && groupOf(s.type) === 'message' && steps[i - 1].type !== 'connect');
  if (mids.some(s => (parseInt(s.delayDays, 10) || 0) === 0)) issues.push({ level: 'warn', text: 'Two messages on the same day read as automated. Give follow-ups at least 1 day.' });
  return issues;
}

/* ---------- LinkedIn URLs & names ---------- */
/* Strict check: only real LinkedIn person links pass (profile /in/…, legacy /pub/…, Sales Navigator lead).
   Returns { ok: true, url, key, slug, kind } or { ok: false, error }. */
const LI_SLUG = /^[\p{L}\p{N}][^\s\/?#,]{2,99}$/u;
function checkLinkedIn(raw) {
  let s = String(raw || '').trim().replace(/^<|>$/g, '').replace(/^["']|["']$/g, '');
  if (!s) return { ok: false, error: 'Paste the LinkedIn profile URL.' };
  if (/\s/.test(s)) return { ok: false, error: 'A LinkedIn URL has no spaces. Copy it from the browser address bar.' };
  if (/^[^/]+@[^/]+\.[a-z]+$/i.test(s)) return { ok: false, error: 'That looks like an email address, not a LinkedIn profile URL.' };
  if (!/^https?:\/\//i.test(s)) {
    if (/^([a-z]{2,3}\.|www\.)?linkedin\.com\//i.test(s)) s = 'https://' + s;
    else if (/^lnkd\.in\//i.test(s)) s = 'https://' + s;
    else if (/^\/?(in|pub)\//i.test(s)) s = 'https://www.linkedin.com/' + s.replace(/^\//, '');
    else return { ok: false, error: 'This is not a LinkedIn URL. Use a profile link like https://www.linkedin.com/in/jane-doe' };
  }
  let u;
  try { u = new URL(s); } catch (e) { return { ok: false, error: 'That URL is not valid.' }; }
  const host = u.hostname.toLowerCase();
  if (host === 'lnkd.in') return { ok: false, error: 'Short lnkd.in links can\'t be checked. Open it and copy the full profile URL.' };
  if (!/^(www\.|[a-z]{2}\.)?linkedin\.com$/.test(host)) return { ok: false, error: 'Only linkedin.com links are allowed here, not ' + host + '.' };
  const path = u.pathname.replace(/\/+$/, '');
  let m = path.match(/^\/in\/([^/]+)/i);
  if (m) {
    const slug = decodeSafe(m[1]).toLowerCase();
    if (!LI_SLUG.test(slug)) return { ok: false, error: 'The profile part "' + slug + '" does not look like a real LinkedIn profile name.' };
    return { ok: true, url: 'https://www.linkedin.com/in/' + encodeURIComponent(slug) + '/', key: 'in:' + slug, slug, kind: 'profile' };
  }
  m = path.match(/^\/pub\/([^/]+)((?:\/[a-z0-9]+){0,3})$/i);
  if (m) {
    const slug = decodeSafe(m[1]).toLowerCase();
    if (!LI_SLUG.test(slug)) return { ok: false, error: 'That old-style /pub/ link does not look like a real profile.' };
    const rest = (m[2] || '').toLowerCase();
    return { ok: true, url: 'https://www.linkedin.com/pub/' + encodeURIComponent(slug) + rest + '/', key: 'pub:' + slug + rest, slug, kind: 'profile' };
  }
  m = path.match(/^\/sales\/(?:lead|people)\/([A-Za-z0-9_\-]{10,})(?:,[^/]*)?$/);
  if (m) return { ok: true, url: 'https://www.linkedin.com' + u.pathname, key: 'sn:' + m[1], slug: '', kind: 'salesnav' };
  const seg = (path.split('/')[1] || '').toLowerCase();
  const why = {
    company: 'That is a company page. Add the person\'s own profile (linkedin.com/in/…).',
    school: 'That is a school page, not a person.', showcase: 'That is a showcase page, not a person.',
    feed: 'That is a post, not a profile. Open the author\'s profile and copy that URL.', posts: 'That is a post, not a profile. Open the author\'s profile and copy that URL.',
    pulse: 'That is an article, not a profile.', jobs: 'That is a job listing, not a profile.', groups: 'That is a group, not a person.',
    events: 'That is an event page, not a person.', search: 'That is a search results page. Open the person and copy their profile URL.',
    mynetwork: 'That is your network page. Open the person and copy their profile URL.', messaging: 'That is a message thread. Open the person\'s profile and copy that URL.',
    sales: 'Use a Sales Navigator lead link (…/sales/lead/…) or the person\'s linkedin.com/in/ URL.',
  }[seg];
  return { ok: false, error: why || 'Only LinkedIn profile links work here (linkedin.com/in/…).' };
}
function normalizeLinkedIn(raw) { const r = checkLinkedIn(raw); return r.ok ? r : null; }
function titleCase(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; }
function nameFromSlug(slug) {
  const words = decodeSafe(String(slug || '')).split(/[-_.]+/)
    .filter(t => t && !/\d/.test(t))
    .map(titleCase);
  if (!words.length) return { firstName: '', lastName: '' };
  return { firstName: words[0], lastName: words.slice(1).join(' ') };
}
function splitName(full) {
  const clean = String(full || '').split(',')[0].replace(/\s+/g, ' ').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(' ');
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
function cleanCompany(name) {
  return String(name || '').trim()
    .replace(/[,\s]+(inc\.?|llc|l\.l\.c\.|ltd\.?|limited|gmbh|pvt\.?\s*ltd\.?|private limited|corp\.?|corporation|plc|s\.a\.|b\.v\.|pty\.?\s*ltd\.?|co\.)$/i, '')
    .trim();
}

/* ---------- profile details from LinkedIn ---------- */
/* "Head of Growth at Acme | B2B SaaS" → "Head of Growth" */
function positionFromHeadline(h) {
  const m = String(h || '').match(/^(.{2,80}?)\s+(?:at|@)\s+[^|·•,]{2,}/i);
  return m ? m[1].trim() : '';
}
function companyFromHeadline(h) {
  const m = String(h || '').match(/\s(?:at|@)\s+([^|·•,(]{2,60})/i);
  return m ? m[1].trim() : '';
}
/* "Position · Company" line for lists. */
function roleLine(p) {
  const pos = p.position || positionFromHeadline(p.title);
  if (pos && p.company) return pos + ' at ' + p.company;
  return [pos || p.title, p.company].filter(Boolean).join(' · ');
}
/* Reads what the "Copy to Outreach Desk" bookmark copied (FOD1:{json}),
   or text copied by hand from the top of a LinkedIn profile.
   Returns only the fields it found: { url, firstName, lastName, title, position, company, location }. */
function parseProfileText(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  const out = {};
  const m = text.match(/FOD1:(\{[\s\S]*\})/);
  if (m) {
    let d = null;
    try { d = JSON.parse(m[1]); } catch (e) { d = null; }
    if (d) {
      const n = splitName(d.name || '');
      if (n.firstName) { out.firstName = n.firstName; out.lastName = n.lastName; }
      const norm = normalizeLinkedIn(d.url);
      if (norm) out.url = norm.url;
      if (d.headline) out.title = String(d.headline).trim();
      if (d.position) out.position = String(d.position).trim();
      if (d.company) out.company = cleanCompany(d.company);
      if (d.location) out.location = String(d.location).replace(/\s*·?\s*Contact info\s*$/i, '').trim();
      if (!out.position && out.title) out.position = positionFromHeadline(out.title);
      if (!out.company && out.title) out.company = companyFromHeadline(out.title);
      return out;
    }
  }
  const urlHit = text.match(/https?:\/\/[^\s]*linkedin\.com\/(?:in|pub|sales\/lead)\/[^\s]+/i);
  if (urlHit && normalizeLinkedIn(urlHit[0])) out.url = normalizeLinkedIn(urlHit[0]).url;
  const noise = /^(she\/her|he\/him|they\/them|he\/they|she\/they)$|^·?\s*(1st|2nd|3rd\+?)( degree connection)?$|^\d[\d,+]*\s+(connections|followers)$|^(500\+ connections)$|^(contact info|message|connect|follow|more|pending|view profile|open to|show all.*|verified|premium|following|mutual connections?.*|.*mutual connections?)$|linkedin\.com|^https?:/i;
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l && !noise.test(l) && l.length < 220);
  if (!lines.length) return out;
  let i = 0;
  const looksName = l => /^[\p{L}][\p{L}'’.\- ]{1,60}$/u.test(l) && l.split(' ').length <= 6 && !/\s(at|@)\s/i.test(l);
  while (i < lines.length && !looksName(lines[i])) i++;
  if (i < lines.length) {
    const n = splitName(lines[i].replace(/\s*\(.*?\)\s*/g, ' '));
    out.firstName = n.firstName; out.lastName = n.lastName;
    i++;
  } else i = 0;
  const rest = lines.slice(i);
  let locIdx = rest.findIndex(l => /contact info$/i.test(l));
  if (locIdx === -1) locIdx = rest.findIndex((l, k) => k > 0 && !/[|@]/.test(l) && l.length < 80 && /\b(area|metropolitan|region|india|united states|united kingdom|canada|germany|uae|australia|singapore)\b/i.test(l));
  if (locIdx !== -1) out.location = rest[locIdx].replace(/\s*·?\s*Contact info\s*$/i, '').trim();
  const head = rest.find((l, k) => k !== locIdx);
  if (head) {
    out.title = head;
    const pos = positionFromHeadline(head);
    const comp = companyFromHeadline(head);
    if (pos) out.position = pos;
    if (comp) out.company = cleanCompany(comp);
  }
  /* "Position" followed by "Company · Full-time" (copied from Experience) */
  for (let k = 0; k < rest.length - 1; k++) {
    const mm = rest[k + 1].match(/^(.{2,60}?)\s+·\s+(full-time|part-time|contract|freelance|self-employed|internship)/i);
    if (mm) { out.position = out.position || rest[k]; out.company = out.company || cleanCompany(mm[1]); break; }
  }
  if (!out.company && head) {
    const after = rest.filter((l, k) => k !== locIdx && l !== head);
    if (after[0] && after[0].length <= 60 && !/university|college|school|institute|academy/i.test(after[0])) out.company = cleanCompany(after[0]);
  }
  if (!out.position && out.title) {
    const first = out.title.split(/\s[|·•]\s|\s-\s/)[0].trim();
    if (first && first.length <= 60 && first !== out.company) out.position = first;
  }
  return out;
}

/* ---------- templates ---------- */
function templateValues(p, client, sender) {
  const sn = (sender && sender.name) || '';
  return {
    firstName: p.firstName, lastName: p.lastName, fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    company: p.company, title: p.title, position: p.position || positionFromHeadline(p.title), location: p.location,
    painPoint: p.painPoint, country: p.country,
    senderName: sn, senderFirstName: sn.split(' ')[0], clientName: client && client.name,
  };
}
function fillTemplate(tpl, p, client, sender) {
  const vals = templateValues(p, client, sender);
  const missing = [];
  const text = String(tpl || '').replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m, k) => {
    if (!(k in vals)) { missing.push(k); return m; }
    const v = String(vals[k] || '').trim();
    if (!v) { missing.push(k); return '[' + k + ']'; }
    return v;
  });
  return { text, missing: Array.from(new Set(missing)) };
}

/* ---------- state transitions (each returns a new prospect doc) ---------- */
function entry(kind, on, by, extra) {
  const e = { ts: nowTs(), on, kind };
  if (by) e.by = by;
  if (extra) for (const k in extra) if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') e[k] = extra[k];
  return e;
}
function statusAfter(seq, idx, p) {
  const steps = (seq && seq.steps) || [];
  if (idx >= steps.length) return 'finished';
  if (idx === 0) return 'queued';
  const c = connectIndex(seq);
  if (c >= idx) return 'queued';
  if (c !== -1 && p.invitedOn && !p.acceptedOn) return 'invited';
  return 'active';
}
function touch(q) { q.updatedAt = nowTs(); return q; }
/* Re-time the entries just added (for work logged later than it happened). */
function retime(q, fromIdx, on, time) {
  if (!isClock(time) && on === todayISO()) return q;
  for (let i = fromIdx; i < q.log.length; i++) q.log[i].ts = tsOf(on, time);
  return q;
}
function prep(p) { const q = clone(p); q.log = Array.isArray(q.log) ? q.log : []; delete q.id; return q; }
function withId(q, p) { q.id = p.id; q.clientId = p.clientId; return q; }

function actCompleteStep(p, seq, on, by) {
  const q = prep(p);
  const steps = (seq && seq.steps) || [];
  const i = stepIndexOf(p, seq);
  const step = steps[i];
  if (!step) return withId(q, p);
  if (q.status === 'invited' && step.type !== 'connect') {
    q.acceptedOn = q.acceptedOn || on;
    q.log.push(entry('accepted', on, by, { auto: true }));
  }
  q.log.push(entry('step', on, by, { stepId: step.id, stepType: step.type, label: stepShort(seq, i), sid: q.senderId }));
  q.lastDoneOn = on;
  q.snoozeUntil = null;
  q.stepIndex = i + 1;
  q.stepId = steps[i + 1] ? steps[i + 1].id : null;
  if (step.type === 'connect') { q.status = 'invited'; q.invitedOn = on; }
  else { q.status = statusAfter(seq, i + 1, q); if (q.status === 'finished') q.closedOn = on; }
  return withId(touch(q), p);
}
function actSkip(p, seq, on, by) {
  const q = prep(p);
  const steps = (seq && seq.steps) || [];
  const i = stepIndexOf(p, seq);
  const step = steps[i];
  if (!step) return withId(q, p);
  q.log.push(entry('skipped', on, by, { stepId: step.id, stepType: step.type, label: stepShort(seq, i) }));
  if (step.type === 'connect') q.alreadyConnected = true;
  q.lastDoneOn = on;
  q.snoozeUntil = null;
  q.stepIndex = i + 1;
  q.stepId = steps[i + 1] ? steps[i + 1].id : null;
  q.status = statusAfter(seq, i + 1, q);
  if (q.status === 'finished') q.closedOn = on;
  return withId(touch(q), p);
}
function actAccept(p, seq, on, by) {
  const q = prep(p);
  q.log.push(entry('accepted', on, by));
  q.acceptedOn = on;
  q.lastDoneOn = on;
  q.snoozeUntil = null;
  const i = stepIndexOf(p, seq);
  if (!seq || i >= seq.steps.length) { q.status = 'finished'; q.closedOn = on; }
  else q.status = 'active';
  return withId(touch(q), p);
}
function actReply(p, seq, on, by, note) {
  const q = prep(p);
  const last = q.log.slice().reverse().find(e => e.kind === 'step');
  q.replyAfter = last ? last.label : 'Before first touch';
  q.prevStatus = q.status;
  q.status = 'replied';
  q.repliedOn = on;
  q.snoozeUntil = null;
  q.log.push(entry('replied', on, by, { after: q.replyAfter, note }));
  return withId(touch(q), p);
}
function actSetStatus(p, seq, status, on, by, opts) {
  opts = opts || {};
  const q = prep(p);
  const from = q.status;
  if (status === 'paused') q.pausedFrom = from;
  q.status = status;
  if ('followUpOn' in opts) { q.followUpOn = opts.followUpOn || null; q.followUpNote = opts.followUpNote || ''; }
  if (status === 'meeting' && opts.meetingOn) q.meetingOn = opts.meetingOn;
  q.closedOn = STATUSES[status] && !STATUSES[status].open ? on : null;
  q.snoozeUntil = null;
  q.log.push(entry('status', on, by, { from, to: status, note: opts.note }));
  return withId(touch(q), p);
}
function actResume(p, seq, on, by) {
  const q = prep(p);
  const i = stepIndexOf(p, seq);
  const st = seq ? statusAfter(seq, i, q) : 'finished';
  q.status = st;
  q.pausedFrom = null;
  q.closedOn = st === 'finished' ? on : null;
  q.snoozeUntil = null;
  q.log.push(entry('resumed', on, by));
  return withId(touch(q), p);
}
function actSnooze(p, until, on, by, time) {
  const q = prep(p);
  q.snoozeUntil = until;
  q.snoozeTime = isClock(time) ? time : null;
  q.log.push(entry('snoozed', on, by, { until, at: q.snoozeTime }));
  return withId(touch(q), p);
}
function actWithdraw(p, on, by, remindOn) {
  const q = prep(p);
  q.status = 'withdrawn';
  q.closedOn = on;
  q.snoozeUntil = null;
  if (remindOn) { q.followUpOn = remindOn; q.followUpNote = 'Re-invite. LinkedIn allows a new invite about 3 weeks after a withdrawal.'; }
  q.log.push(entry('withdrawn', on, by));
  return withId(touch(q), p);
}
function actRestart(p, seq, on, by, skipInvite) {
  const q = prep(p);
  const steps = (seq && seq.steps) || [];
  let idx = 0;
  const c = connectIndex(seq);
  if (skipInvite && c !== -1) idx = c + 1;
  q.stepIndex = idx;
  q.stepId = steps[idx] ? steps[idx].id : null;
  q.startOn = on;
  q.lastDoneOn = skipInvite ? on : null;
  q.invitedOn = null; q.acceptedOn = null; q.repliedOn = null; q.closedOn = null;
  q.snoozeUntil = null; q.pausedFrom = null; q.replyAfter = null;
  if (skipInvite) q.alreadyConnected = true;
  q.status = idx >= steps.length ? 'finished' : (skipInvite ? 'active' : 'queued');
  q.log.push(entry('restarted', on, by));
  return withId(touch(q), p);
}
function actChangeSequence(p, seq, startIdx, on, by) {
  const q = prep(p);
  const idx = Math.max(0, Math.min(startIdx | 0, seq.steps.length));
  q.sequenceId = seq.id;
  q.stepIndex = idx;
  q.stepId = seq.steps[idx] ? seq.steps[idx].id : null;
  q.snoozeUntil = null;
  if (['queued', 'active', 'invited'].indexOf(q.status) !== -1) {
    q.status = statusAfter(seq, idx, q);
    if (q.status === 'finished') q.closedOn = on;
  }
  q.log.push(entry('sequence', on, by, { note: 'Moved to "' + seq.name + '" at step ' + (idx + 1) }));
  return withId(touch(q), p);
}
function actSetReminder(p, date, note, on, by, time) {
  const q = prep(p);
  q.followUpOn = date;
  q.followUpTime = isClock(time) ? time : null;
  q.followUpNote = note || '';
  q.log.push(entry('reminder', on, by, { until: date, at: q.followUpTime, note }));
  return withId(touch(q), p);
}
function actReminderDone(p, on, by) {
  const q = prep(p);
  q.log.push(entry('reminder_done', on, by, { note: q.followUpNote }));
  q.followUpOn = null;
  q.followUpTime = null;
  q.followUpNote = '';
  return withId(touch(q), p);
}
function actNote(p, text, on, by) {
  const q = prep(p);
  q.log.push(entry('note', on, by, { note: text }));
  return withId(touch(q), p);
}

/* ---------- activity (the log, as people read it) ---------- */
const ACTIVITY_KINDS = {
  added: { label: 'Added', icon: 'plus', tone: 'neutral' },
  invite: { label: 'Invite sent', icon: 'userPlus', tone: 'info' },
  message: { label: 'Message sent', icon: 'message', tone: 'accent' },
  touch: { label: 'Touch', icon: 'eye', tone: 'neutral' },
  accepted: { label: 'Accepted', icon: 'userCheck', tone: 'good' },
  replied: { label: 'Replied', icon: 'reply', tone: 'reply' },
  status: { label: 'Outcome', icon: 'flag', tone: 'good' },
  reminder: { label: 'Reminder', icon: 'bell', tone: 'today' },
  engage: { label: 'Engagement', icon: 'thumbsUp', tone: 'reply' },
  withdrawn: { label: 'Withdrawn', icon: 'logout', tone: 'muted' },
  note: { label: 'Note', icon: 'edit', tone: 'neutral' },
  admin: { label: 'Update', icon: 'sliders', tone: 'neutral' },
};
function activityKind(e) {
  if (e.kind === 'step') { const g = groupOf(e.stepType); return g === 'invite' ? 'invite' : g === 'message' ? 'message' : 'touch'; }
  if (e.kind === 'accepted' || e.kind === 'replied' || e.kind === 'status' || e.kind === 'withdrawn' || e.kind === 'note') return e.kind;
  if (e.kind === 'reminder' || e.kind === 'reminder_done') return 'reminder';
  if (e.kind === 'added') return 'added';
  if (e.kind === 'engage') return 'engage';
  return 'admin';
}
function activityText(e) {
  const at = e.at ? ' at ' + fmtClock(e.at) : '';
  switch (e.kind) {
    case 'added': return 'Added' + (e.note ? ' (' + e.note + ')' : '');
    case 'step': return e.label + (groupOf(e.stepType) === 'touch' ? ' done' : ' sent');
    case 'skipped': return e.label + ' skipped';
    case 'accepted': return e.auto ? 'Accepted (logged with the next step)' : 'Accepted the connection request';
    case 'replied': return 'Replied' + (e.after ? ' after ' + e.after.toLowerCase() : '');
    case 'status': return 'Marked ' + ((STATUSES[e.to] || {}).label || e.to).toLowerCase();
    case 'snoozed': return 'Snoozed until ' + fmtDay(e.until) + at;
    case 'reminder': return 'Reminder set for ' + fmtDay(e.until) + at;
    case 'reminder_done': return 'Reminder done';
    case 'withdrawn': return 'Invite withdrawn';
    case 'resumed': return 'Sequence resumed';
    case 'restarted': return 'Sequence restarted';
    case 'sequence': return e.note || 'Sequence changed';
    case 'list': return e.note || 'List changed';
    case 'engage': return (ENGAGE_TYPES[e.channel] || ENGAGE_TYPES.other).label;
    case 'note': return 'Note';
    default: return e.kind;
  }
}
function activityNote(e) { return e.note && e.kind !== 'added' && !(e.kind === 'engage' && e.note === (ENGAGE_TYPES[e.channel] || {}).label) && e.kind !== 'sequence' && e.kind !== 'list' ? e.note : ''; }
function actSetList(p, listId, listName, on, by) {
  const q = prep(p);
  q.listId = listId || null;
  q.log.push(entry('list', on, by, { note: listId ? 'Added to list "' + listName + '"' : 'Removed from list' }));
  return withId(touch(q), p);
}

/* ---------- relationship fields & engagement ---------- */
const POTENTIALS = { high: { label: 'High', tone: 'good', rank: 0 }, medium: { label: 'Medium', tone: 'today', rank: 1 }, low: { label: 'Low', tone: 'muted', rank: 2 } };
function normPotential(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (/^(h|high|hot|a|3|top)\b/.test(s)) return 'high';
  if (/^(m|med|medium|warm|b|2|mid)/.test(s)) return 'medium';
  if (/^(l|low|cold|c|1)\b/.test(s)) return 'low';
  return '';
}
const ENGAGE_TYPES = {
  they_engaged: { label: 'They liked or commented on our post', inbound: true },
  they_viewed: { label: 'They viewed our profile', inbound: true },
  we_commented: { label: 'We commented on their post' },
  we_liked: { label: 'We liked their post' },
  call: { label: 'Phone call' },
  whatsapp: { label: 'WhatsApp message' },
  email: { label: 'Email' },
  meeting: { label: 'Met (video or in person)' },
  other: { label: 'Other interaction' },
};
function actEngage(p, channel, note, on, by) {
  const q = prep(p);
  q.log.push(entry('engage', on, by, { channel: ENGAGE_TYPES[channel] ? channel : 'other', note }));
  return withId(touch(q), p);
}
/* Last time anything happened with this person (any logged activity). */
function lastTouchOn(p) { const l = p.log || []; return l.length ? l[l.length - 1].on : (p.addedOn || null); }

/* "23 Sep", "Sep 23", "23/09/2026", "2026-09-23", "23-Sep-26", Excel serial numbers → YYYY-MM-DD (or null). */
function parseLooseDate(raw, today) {
  const s = String(raw == null ? '' : raw).trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  if (!s) return null;
  const t = today || todayISO();
  const ty = dateOf(t).getFullYear();
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const mk = (y, m, d, guessYear) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    let yy = y == null ? ty : (y < 100 ? 2000 + y : y);
    const dt = new Date(yy, m - 1, d, 12);
    if (dt.getMonth() !== m - 1) return null;
    let iso = isoOf(dt);
    if (guessYear && iso > addDays(t, 31)) iso = isoOf(new Date(yy - 1, m - 1, d, 12));
    return iso;
  };
  let m;
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Math.floor(parseFloat(s)); if (n > 30000 && n < 70000) { const d = new Date(1899, 11, 30, 12); d.setDate(d.getDate() + n); return isoOf(d); } }
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return mk(+m[1], +m[2], +m[3], false);
  if ((m = s.match(/^(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})\.?(?:[\s\-\/,]+(\d{2,4}))?$/)) && MON[m[2].slice(0, 3).toLowerCase()]) return mk(m[3] ? +m[3] : null, MON[m[2].slice(0, 3).toLowerCase()], +m[1], !m[3]);
  if ((m = s.match(/^([A-Za-z]{3,9})\.?[\s\-\/]*(\d{1,2})(?:[\s,\-\/]+(\d{2,4}))?$/)) && MON[m[1].slice(0, 3).toLowerCase()]) return mk(m[3] ? +m[3] : null, MON[m[1].slice(0, 3).toLowerCase()], +m[2], !m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/))) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) { const x = d; d = mo; mo = x; }
    return mk(m[3] ? +m[3] : null, mo, d, !m[3]);
  }
  return null;
}
/* Free-text status from a spreadsheet → what it means here. */
function mapStatusText(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (/not interested|no interest|rejected|declined|unsubscribe|^no$/.test(s)) return 'not_interested';
  if (/meeting|call booked|demo|booked|scheduled|won|client|closed/.test(s)) return 'meeting';
  if (/interested|hot|warm|positive/.test(s)) return 'interested';
  if (/later|nurture|not now|follow up later/.test(s)) return 'nurture';
  if (/repl|respond|answered/.test(s)) return 'replied';
  if (/withdraw/.test(s)) return 'withdrawn';
  if (/no reply|no response|ghost|finished|completed/.test(s)) return 'finished';
  if (/accept|connected/.test(s)) return 'accepted';
  if (/pending|sent|invited|request/.test(s)) return 'invited';
  return null;
}
/* Titles that ended up in a "Company" column ("Founder", "CEO", "Managing Director"…). */
const TITLE_RE = /\b(founder|co[\s-]?founder|ceo|cto|coo|cfo|cmo|cmd|md|director|directer|directore|owner|partner|partne|head|manager|chairman|chariman|chair|president|executive|consultant|strategist|developer|engineer|lead|officer|vp|vice|plant|supplier|manufacturer|research|operations?|proprietor|principal)\b/i;
function looksLikeTitle(v) { const s = String(v || '').trim(); return !!s && s.length <= 60 && TITLE_RE.test(s) && !/\b(pvt|ltd|llp|inc|limited|industries|international|group|solutions|technologies|enterprises?|company)\b/i.test(s); }

/* Turns an imported spreadsheet row into a prospect with real history.
   opts.connMeaning: 'sent' (request sent that day) | 'accepted' (connected that day) | 'none'
   opts.lastMeaning: 'replied' | 'messaged' | 'engaged' | 'none' */
function prospectFromRow(row, opts) {
  const T = opts.today;
  const seq = opts.seq;
  const by = opts.by || null;
  const conn = row.connectionDate && row.connectionDate <= T ? row.connectionDate : null;
  const start = conn || (isISODate(opts.startOn) ? opts.startOn : T);
  let p = newProspect(Object.assign({}, row, { clientId: opts.clientId, senderId: opts.senderId, listId: opts.listId || null, startOn: start }),
    { seq, today: conn || T, by, source: opts.source || 'Spreadsheet import' });
  if (p.log && p.log[0]) p.log[0].ts = tsOf(start, '09:30');
  const stamp = (fn, on) => { const n = (p.log || []).length; p = fn(); retime(p, n, on, '10:00'); };
  const c = connectIndex(seq);
  if (conn && opts.connMeaning !== 'none' && seq && c !== -1) {
    if (c > 0) { p.stepIndex = c; p.stepId = seq.steps[c].id; }
    stamp(() => actCompleteStep(p, seq, conn, by), conn);
    if (opts.connMeaning === 'accepted') stamp(() => actAccept(p, seq, conn, by), conn);
  }
  const L = row.lastInteraction && row.lastInteraction <= T ? row.lastInteraction : null;
  if (L && opts.lastMeaning && opts.lastMeaning !== 'none') {
    if ((opts.lastMeaning === 'replied' || opts.lastMeaning === 'messaged') && p.status === 'invited') {
      stamp(() => actAccept(p, seq, L, by), L);
      p.log[p.log.length - 1].note = 'Assumed from the spreadsheet (they ' + (opts.lastMeaning === 'replied' ? 'replied' : 'were messaged') + ')';
    }
    if (opts.lastMeaning === 'replied') stamp(() => actReply(p, seq, L, by, 'From spreadsheet: last interaction ' + fmtShort(L)), L);
    else if (opts.lastMeaning === 'messaged' && (p.status === 'active' || p.status === 'queued')) stamp(() => actCompleteStep(p, seq, L, by), L);
    else if (opts.lastMeaning === 'engaged') stamp(() => actEngage(p, 'other', 'From spreadsheet', L, by), L);
  }
  const st = mapStatusText(row.status);
  if (st) {
    const on = L || conn || T;
    if (st === 'accepted' && p.status === 'invited') stamp(() => actAccept(p, seq, on, by), on);
    else if (st === 'replied' && p.status !== 'replied') stamp(() => actReply(p, seq, on, by, 'Status in spreadsheet: ' + row.status), on);
    else if (['interested', 'meeting', 'not_interested', 'nurture', 'finished', 'withdrawn'].indexOf(st) !== -1) {
      if (p.status !== 'replied' && st !== 'finished' && st !== 'withdrawn') stamp(() => actReply(p, seq, on, by, 'Status in spreadsheet: ' + row.status), on);
      stamp(() => actSetStatus(p, seq, st, on, by, { note: 'From spreadsheet' }), on);
    }
  }
  const nf = row.nextFollowUp;
  if (nf) { p.followUpOn = nf; p.followUpNote = 'Follow up (from spreadsheet)'; }
  if (row.nameFromUrl) p.nameFromUrl = true;
  delete p.id; p.id = prospectDocId(row.norm.key);
  return p;
}

/* ---------- creating prospects ---------- */
function newProspect(f, ctx) {
  const seq = ctx.seq || null;
  const on = ctx.today;
  const start = isISODate(f.startOn) ? f.startOn : on;
  const steps = (seq && seq.steps) || [];
  const p = {
    id: prospectDocId(f.norm.key),
    clientId: f.clientId, senderId: f.senderId || null, sequenceId: seq ? seq.id : null, listId: f.listId || null,
    firstName: String(f.firstName || '').trim(), lastName: String(f.lastName || '').trim(),
    title: String(f.title || '').trim(), position: String(f.position || '').trim(), company: String(f.company || '').trim(),
    location: String(f.location || '').trim(), email: String(f.email || '').trim(),
    country: String(f.country || '').trim(), painPoint: String(f.painPoint || '').trim(), potential: normPotential(f.potential),
    url: f.norm.url, urlKey: f.norm.key, urlKind: f.norm.kind,
    tags: Array.isArray(f.tags) ? f.tags : String(f.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    notes: String(f.notes || '').trim(),
    status: steps.length ? 'queued' : 'finished',
    stepIndex: 0, stepId: steps[0] ? steps[0].id : null,
    addedOn: on, startOn: start, lastDoneOn: null, invitedOn: null, acceptedOn: null, repliedOn: null, closedOn: null,
    snoozeUntil: null, followUpOn: null, followUpNote: '',
    log: [entry('added', on, ctx.by, { note: ctx.source })],
    createdAt: nowTs(), updatedAt: nowTs(),
  };
  if (f.alreadyConnected && seq) {
    const c = connectIndex(seq);
    if (c !== -1) {
      p.stepIndex = c + 1;
      p.stepId = steps[c + 1] ? steps[c + 1].id : null;
      p.lastDoneOn = start;
      p.alreadyConnected = true;
      p.status = steps[c + 1] ? 'active' : 'finished';
    }
  }
  return p;
}

/* ---------- the daily queue ---------- */
function stepDue(p, seq, i, settings) {
  const step = seq.steps[i];
  const base = p.lastDoneOn || p.startOn || p.addedOn || todayISO();
  let due = addDays(base, Math.max(0, parseInt(step.delayDays, 10) || 0));
  due = nextWorkday(due, settings.workDays);
  if (p.snoozeUntil && p.snoozeUntil >= due) due = p.snoozeUntil;
  return due;
}
/* Scheduled clock time for a step task: a snooze time wins on its day, else the step's own send time. */
function stepTime(p, seq, i, due) {
  if (p.snoozeUntil && p.snoozeUntil === due && isClock(p.snoozeTime)) return p.snoozeTime;
  const st = seq.steps[i];
  return st && isClock(st.time) ? st.time : '';
}
function senderOf(client, p) { return ((client && client.senders) || []).find(s => s.id === p.senderId) || null; }
function operatorOf(client, sender) { return (sender && sender.ownerId) || (client && client.ownerId) || null; }

function prospectTasks(p, ctx) {
  const out = [];
  const client = ctx.clients[p.clientId];
  const seq = ctx.seqs[p.sequenceId];
  const sender = senderOf(client, p);
  const t = ctx.today;
  const base = { p, client, sender, seq };
  if (p.status === 'replied') {
    out.push(Object.assign({ key: p.clientId + '/' + p.id + ':reply', kind: 'reply', group: 'reply', due: p.repliedOn || t }, base));
  } else if ((p.status === 'queued' || p.status === 'active') && seq) {
    const i = stepIndexOf(p, seq);
    if (i < seq.steps.length) {
      const step = seq.steps[i];
      const filled = fillTemplate(step.template, p, client, sender);
      const due = stepDue(p, seq, i, ctx.settings);
      out.push(Object.assign({
        key: p.clientId + '/' + p.id + ':step:' + i, kind: 'step', group: groupOf(step.type),
        idx: i, step, due, time: stepTime(p, seq, i, due),
        title: stepTitle(seq, i), text: filled.text, missing: filled.missing,
      }, base));
    }
  } else if (p.status === 'invited') {
    const days = p.invitedOn ? daysBetween(p.invitedOn, t) : 0;
    const limit = ctx.settings.staleDays > 0 ? ctx.settings.staleDays : Infinity;
    const snoozed = p.snoozeUntil && p.snoozeUntil > t;
    out.push(Object.assign({
      key: p.clientId + '/' + p.id + ':pending', kind: 'pending', group: 'pending',
      due: p.invitedOn || t, pendingDays: days, stale: days >= limit && !snoozed,
    }, base));
  }
  if (p.followUpOn) {
    out.push(Object.assign({ key: p.clientId + '/' + p.id + ':reminder', kind: 'reminder', group: 'reminder', due: p.followUpOn, time: isClock(p.followUpTime) ? p.followUpTime : '', note: p.followUpNote || '' }, base));
  }
  return out;
}

function emptyUsage() { return { invitesToday: 0, invitesWeek: 0, messagesToday: 0, touchesToday: 0 }; }
function senderUsage(prospects, t) {
  const map = {};
  const weekStart = addDays(t, -6);
  for (const p of prospects) {
    for (const e of p.log || []) {
      if (e.kind !== 'step' || e.on < weekStart || e.on > t) continue;
      const key = p.clientId + '|' + (e.sid || p.senderId || 'none');
      const u = map[key] || (map[key] = emptyUsage());
      const g = groupOf(e.stepType);
      if (g === 'invite') { u.invitesWeek++; if (e.on === t) u.invitesToday++; }
      else if (e.on === t) { if (g === 'message') u.messagesToday++; else u.touchesToday++; }
    }
  }
  return map;
}
function inviteAllowance(sender, usage) {
  if (!sender) return Infinity;
  const d = parseInt(sender.dailyInvites, 10) || 0;
  const w = parseInt(sender.weeklyInvites, 10) || 0;
  let a = Infinity;
  if (d > 0) a = Math.min(a, d - usage.invitesToday);
  if (w > 0) a = Math.min(a, w - usage.invitesWeek);
  return Math.max(0, a);
}

const GROUP_RANK = { reply: 0, message: 1, reminder: 2, touch: 3, invite: 4, pending: 5 };
/* Overdue first, then scheduled times in clock order, then "any time" tasks by type. */
function taskOrder(x, y) {
  if (x.due !== y.due) return x.due < y.due ? -1 : 1;
  const tx = x.time || '99:99', ty = y.time || '99:99';
  if (tx !== ty) return tx < ty ? -1 : 1;
  return (GROUP_RANK[x.group] - GROUP_RANK[y.group]) || byText(fullName(x.p), fullName(y.p));
}
const DONE_KINDS = { step: 1, accepted: 1, replied: 1, withdrawn: 1, reminder_done: 1, status: 1, skipped: 1, engage: 1 };

/* Builds everything the Today screen shows.
   data: { clients, seqs, prospects[], settings }   opts: { today, clientId, operatorId } */
function buildBoard(data, opts) {
  const t = opts.today;
  const ctx = { clients: data.clients, seqs: data.seqs, settings: data.settings, today: t };
  const usage = senderUsage(data.prospects, t);
  const accounts = new Map();
  const replies = [], upcoming = [], hiddenClients = new Set();
  let doneToday = 0;
  const horizon = addDays(t, 14);
  function account(client, sender) {
    const key = client.id + '|' + (sender ? sender.id : 'none');
    let a = accounts.get(key);
    if (!a) {
      const u = usage[key] || emptyUsage();
      a = { key, client, sender, operatorId: operatorOf(client, sender), usage: u, allowance: inviteAllowance(sender, u), tasks: [], overLimit: [], pending: [], stale: [] };
      accounts.set(key, a);
    }
    return a;
  }
  for (const p of data.prospects) {
    const client = data.clients[p.clientId];
    if (!client) continue;
    if (opts.clientId && p.clientId !== opts.clientId) continue;
    if (opts.listId && (p.listId || '') !== (opts.listId === '_none' ? '' : opts.listId)) continue;
    const sender = senderOf(client, p);
    if (opts.operatorId && operatorOf(client, sender) !== opts.operatorId) continue;
    for (const e of p.log || []) if (e.on === t && DONE_KINDS[e.kind]) doneToday++;
    if (client.status && client.status !== 'active') { hiddenClients.add(client.id); continue; }
    for (const task of prospectTasks(p, ctx)) {
      if (task.kind === 'reply') { replies.push(task); continue; }
      if (task.kind === 'pending') {
        const a = account(client, sender);
        a.pending.push(task);
        if (task.stale) a.stale.push(task);
        continue;
      }
      if (task.due <= t) account(client, sender).tasks.push(task);
      else if (task.due <= horizon) upcoming.push(task);
    }
  }
  const list = Array.from(accounts.values());
  let overdue = 0, dueToday = 0, overLimit = 0, pending = 0, stale = 0;
  for (const a of list) {
    const invites = a.tasks.filter(x => x.group === 'invite').sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : byText(x.p.addedOn, y.p.addedOn) || byText(fullName(x.p), fullName(y.p))));
    const keep = new Set(invites.slice(0, a.allowance === Infinity ? invites.length : a.allowance));
    a.overLimit = invites.filter(x => !keep.has(x));
    a.tasks = a.tasks.filter(x => x.group !== 'invite' || keep.has(x));
    a.tasks.sort(taskOrder);
    a.pending.sort((x, y) => y.pendingDays - x.pendingDays);
    for (const x of a.tasks) { if (x.due < t) overdue++; else dueToday++; }
    overLimit += a.overLimit.length;
    pending += a.pending.length;
    stale += a.stale.length;
  }
  list.sort((x, y) => byText(x.client.name, y.client.name) || byText(x.sender ? x.sender.name : '~', y.sender ? y.sender.name : '~'));
  replies.sort((x, y) => (x.due < y.due ? -1 : 1));
  const byDay = {};
  for (const x of upcoming) (byDay[x.due] || (byDay[x.due] = [])).push(x);
  const days = Object.keys(byDay).sort().map(d => ({ date: d, tasks: byDay[d] }));
  const open = replies.length + overdue + dueToday + stale;
  return {
    today: t, replies, accounts: list, upcoming: days, hiddenClients: Array.from(hiddenClients),
    counts: { replies: replies.length, overdue, dueToday, pending, stale, overLimit, doneToday, open, upcoming: upcoming.length },
  };
}

/* One-line "what's next" for lists and the detail panel. */
function nextAction(p, data, t) {
  const tasks = prospectTasks(p, { clients: data.clients, seqs: data.seqs, settings: data.settings, today: t });
  const main = tasks.find(x => x.kind !== 'reminder');
  const rem = tasks.find(x => x.kind === 'reminder');
  if (main) {
    if (main.kind === 'reply') return { text: 'Reply waiting since ' + relDay(main.due, t), tone: 'reply', due: main.due, task: main };
    if (main.kind === 'pending') return main.stale
      ? { text: 'Pending ' + main.pendingDays + ' days. Withdraw?', tone: 'overdue', due: main.due, task: main }
      : { text: 'Waiting for acceptance · ' + plural(main.pendingDays, 'day'), tone: 'info', due: main.due, task: main };
    const di = dueInfo(main.due, t, main.time);
    return { text: stepShort(main.seq, main.idx), sub: di.text, tone: di.tone, due: main.due, task: main };
  }
  if (rem) { const di = dueInfo(rem.due, t, rem.time); return { text: 'Reminder' + (rem.note ? ': ' + rem.note : ''), sub: di.text, tone: di.tone, due: rem.due, task: rem }; }
  return null;
}

/* Done / current / future steps with real or projected dates. */
function projectTimeline(p, seq, settings, t) {
  const steps = (seq && seq.steps) || [];
  const cur = stepIndexOf(p, seq);
  const done = {};
  for (const e of p.log || []) if ((e.kind === 'step' || e.kind === 'skipped') && e.stepId) done[e.stepId] = e;
  const open = ['queued', 'active', 'invited'].indexOf(p.status) !== -1;
  let prev = null, gated = false, rel = 0;
  return steps.map((step, i) => {
    const d = Math.max(0, parseInt(step.delayDays, 10) || 0);
    if (i < cur) {
      const e = done[step.id];
      return { step, i, state: e && e.kind === 'skipped' ? 'skipped' : 'done', on: e ? e.on : null };
    }
    if (!open) return { step, i, state: 'stopped' };
    if (i === cur) {
      if (p.status === 'invited') { gated = true; rel = d; return { step, i, state: 'waiting', rel }; }
      const due = stepDue(p, seq, i, settings);
      prev = due < t ? t : due;
      if (step.type === 'connect') gated = true;
      return { step, i, state: 'current', due };
    }
    if (gated) {
      const afterConnect = steps[i - 1] && steps[i - 1].type === 'connect';
      rel = afterConnect ? d : rel + d;
      return { step, i, state: 'future', rel, gate: afterConnect };
    }
    const due = nextWorkday(addDays(prev || t, d), settings.workDays);
    prev = due;
    if (step.type === 'connect') gated = true;
    return { step, i, state: 'future', due };
  });
}

/* ---------- analytics ---------- */
function periodRange(key, t) {
  const d = dateOf(t);
  switch (key) {
    case '7d': return { from: addDays(t, -6), to: t, label: 'Last 7 days' };
    case '30d': return { from: addDays(t, -29), to: t, label: 'Last 30 days' };
    case '90d': return { from: addDays(t, -89), to: t, label: 'Last 90 days' };
    case 'month': return { from: isoOf(new Date(d.getFullYear(), d.getMonth(), 1, 12)), to: t, label: MONTHS_LONG[d.getMonth()] + ' to date' };
    case 'lastmonth': {
      const s = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
      const e = new Date(d.getFullYear(), d.getMonth(), 0, 12);
      return { from: isoOf(s), to: isoOf(e), label: MONTHS_LONG[s.getMonth()] + ' ' + s.getFullYear() };
    }
    default: return { from: null, to: t, label: 'All time' };
  }
}
function analyze(prospects, range) {
  const from = range.from, to = range.to;
  const inR = on => on && (!from || on >= from) && (!to || on <= to);
  const k = { invites: 0, accepted: 0, messages: 0, touches: 0, replies: 0, positive: 0, meetings: 0 };
  const byDay = {}, replyAfter = {}, members = {};
  const funnel = { invited: 0, accepted: 0, replied: 0, positive: 0, meeting: 0 };
  let msgCohort = 0, msgReplied = 0, firstDay = null;
  const mem = id => members[id || '_'] || (members[id || '_'] = { invites: 0, messages: 0, touches: 0, handled: 0 });
  const day = on => byDay[on] || (byDay[on] = { invites: 0, messages: 0, replies: 0 });
  for (const p of prospects) {
    const log = p.log || [];
    let replied = false, positive = false, meeting = false;
    for (const e of log) {
      if (!firstDay || e.on < firstDay) firstDay = e.on;
      if (!inR(e.on)) continue;
      if (e.kind === 'step') {
        const g = groupOf(e.stepType);
        if (g === 'invite') { k.invites++; day(e.on).invites++; mem(e.by).invites++; }
        else if (g === 'message') { k.messages++; day(e.on).messages++; mem(e.by).messages++; }
        else { k.touches++; mem(e.by).touches++; }
      } else if (e.kind === 'accepted') { k.accepted++; }
      else if (e.kind === 'replied') {
        if (!replied) { k.replies++; day(e.on).replies++; replyAfter[e.after || 'Unknown'] = (replyAfter[e.after || 'Unknown'] || 0) + 1; }
        replied = true;
      } else if (e.kind === 'status') {
        mem(e.by).handled++;
        if ((e.to === 'interested' || e.to === 'meeting') && !positive) { positive = true; k.positive++; }
        if (e.to === 'meeting' && !meeting) { meeting = true; k.meetings++; }
      }
    }
    const inv = log.find(e => e.kind === 'step' && groupOf(e.stepType) === 'invite');
    if (inv && inR(inv.on)) {
      funnel.invited++;
      if (log.some(e => e.kind === 'accepted' && e.on >= inv.on)) funnel.accepted++;
      if (log.some(e => e.kind === 'replied' && e.on >= inv.on)) funnel.replied++;
      if (log.some(e => e.kind === 'status' && (e.to === 'interested' || e.to === 'meeting'))) funnel.positive++;
      if (log.some(e => e.kind === 'status' && e.to === 'meeting')) funnel.meeting++;
    }
    const msg = log.find(e => e.kind === 'step' && groupOf(e.stepType) === 'message');
    if (msg && inR(msg.on)) { msgCohort++; if (log.some(e => e.kind === 'replied' && e.on >= msg.on)) msgReplied++; }
  }
  return {
    k, byDay, replyAfter, members, funnel, firstDay,
    acceptRate: pct(funnel.accepted, funnel.invited),
    replyRate: pct(msgReplied, msgCohort), msgCohort, msgReplied,
    positiveRate: pct(k.positive, k.replies),
  };
}
function dailySeries(a, range, t) {
  const from = range.from || a.firstDay || addDays(t, -29);
  const to = range.to || t;
  const n = daysBetween(from, to) + 1;
  const weekly = n > 92;
  const out = [];
  if (!weekly) {
    for (let i = 0; i < n; i++) { const d = addDays(from, i); const v = a.byDay[d] || {}; out.push({ date: d, label: fmtShort(d), invites: v.invites || 0, messages: v.messages || 0 }); }
  } else {
    for (let i = 0; i < n; i += 7) {
      const s = addDays(from, i); let inv = 0, msg = 0;
      for (let j = 0; j < 7 && i + j < n; j++) { const v = a.byDay[addDays(from, i + j)] || {}; inv += v.invites || 0; msg += v.messages || 0; }
      out.push({ date: s, label: 'Wk of ' + fmtShort(s), invites: inv, messages: msg });
    }
  }
  return { points: out, weekly };
}
function statusCounts(prospects) {
  const c = {};
  for (const s of STATUS_ORDER) c[s] = 0;
  for (const p of prospects) c[p.status] = (c[p.status] || 0) + 1;
  return c;
}

/* ---------- text builders ---------- */
function planText(board, data, me) {
  const lines = ['LinkedIn plan for ' + fmtLong(board.today)];
  if (board.replies.length) lines.push('', 'Replies waiting (' + board.replies.length + '): ' + board.replies.map(x => fullName(x.p) + ' (' + x.client.name + ')').join(', '));
  for (const a of board.accounts) {
    const g = { message: 0, invite: 0, touch: 0, reminder: 0 };
    for (const x of a.tasks) g[x.group] = (g[x.group] || 0) + 1;
    const parts = [];
    if (g.message) parts.push(plural(g.message, 'message'));
    if (g.invite) parts.push(plural(g.invite, 'invite'));
    if (g.touch) parts.push(plural(g.touch, 'touch', 'touches'));
    if (g.reminder) parts.push(plural(g.reminder, 'reminder'));
    if (a.stale.length) parts.push(a.stale.length + ' to withdraw');
    if (!parts.length && !a.pending.length) continue;
    const who = a.sender ? a.sender.name : 'no account set';
    const op = (data.settings.team || []).find(m => m.id === a.operatorId);
    lines.push('', a.client.name + ' · ' + who + (op ? ' (' + op.name + ')' : '') + ': ' + (parts.join(', ') || 'nothing due') + (a.pending.length ? ' · ' + a.pending.length + ' invites pending' : ''));
  }
  const c = board.counts;
  lines.push('', 'Total: ' + plural(c.open, 'action') + (c.overdue ? ' (' + c.overdue + ' overdue)' : '') + '.');
  return lines.join('\n');
}
function reportText(title, range, a, sc) {
  const L = [];
  L.push(title + ' · LinkedIn outreach report');
  L.push(range.label + (range.from ? ' (' + fmtShort(range.from) + ' to ' + fmtShort(range.to) + ')' : ''));
  L.push('');
  L.push('Connection requests sent: ' + fmtNum(a.k.invites));
  L.push('New connections: ' + fmtNum(a.k.accepted) + (a.acceptRate != null ? ' (' + a.acceptRate + '% of this period\'s invites accepted so far)' : ''));
  L.push('Messages sent: ' + fmtNum(a.k.messages));
  L.push('Replies: ' + fmtNum(a.k.replies) + (a.replyRate != null ? ' (' + a.replyRate + '% reply rate)' : ''));
  L.push('Positive replies: ' + fmtNum(a.k.positive) + ' · Meetings booked: ' + fmtNum(a.k.meetings));
  const top = Object.entries(a.replyAfter).sort((x, y) => y[1] - x[1])[0];
  if (top) L.push('Step that earned the most replies: ' + top[0] + ' (' + top[1] + ')');
  if (sc) { L.push(''); L.push('Pipeline now: ' + sc.invited + ' invites pending · ' + sc.active + ' in sequence · ' + (sc.replied + sc.interested) + ' conversations open · ' + sc.meeting + ' meetings booked in total'); }
  return L.join('\n');
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  let delim = ',', best = -1;
  for (const d of [',', ';', '\t']) { const c = first.split(d).length - 1; if (c > best) { best = c; delim = d; } }
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"' && field === '') q = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }

const IMPORT_FIELDS = [
  { key: 'url', label: 'LinkedIn URL', required: true },
  { key: 'fullName', label: 'Full name', re: /^(full[\s_-]*)?name$|^contact$|^person$|^lead$|^prospect$/i },
  { key: 'firstName', label: 'First name', re: /^first[\s_-]*name$|^first$|^given[\s_-]*name$|^fname$/i },
  { key: 'lastName', label: 'Last name', re: /^last[\s_-]*name$|^last$|^surname$|^family[\s_-]*name$|^lname$/i },
  { key: 'title', label: 'Headline', re: /headline|summary|tagline/i },
  { key: 'position', label: 'Position / job title', re: /title|position|role|job|designation/i },
  { key: 'company', label: 'Company', re: /company|organi[sz]ation|employer|account/i, not: /url|linkedin|website|domain|size|industry|id$/i },
  { key: 'location', label: 'Location / city', re: /location|city|region|geo/i },
  { key: 'country', label: 'Country', re: /country|nation/i },
  { key: 'potential', label: 'Potential', re: /potential|priority|score|rating|fit/i },
  { key: 'painPoint', label: 'Interest / pain point', re: /pain|interest|need|challenge/i },
  { key: 'connectionDate', label: 'Connection date', re: /connection date|connected|invite|request|sent on|date sent/i },
  { key: 'lastInteraction', label: 'Last interaction', re: /last interaction|last contact|last touch|last activity|replied on/i },
  { key: 'nextFollowUp', label: 'Next follow-up', re: /next follow|follow.?up date|follow.?up on|next action/i },
  { key: 'status', label: 'Status', re: /^status$|stage|state/i },
  { key: 'email', label: 'Email', re: /e-?mail/i },
  { key: 'tags', label: 'Tags', re: /tag|segment|campaign|list/i },
  { key: 'notes', label: 'Notes', re: /note|comment|icebreaker|personali[sz]/i },
];
function guessMapping(header, rows) {
  const map = {};
  const used = new Set();
  let best = -1, bestCol = -1;
  header.forEach((h, c) => {
    let hits = 0;
    for (const r of rows.slice(0, 30)) if (normalizeLinkedIn(r[c])) hits++;
    const bonus = /linkedin|profile/i.test(h) && !/company/i.test(h) ? 0.5 : 0;
    if (hits + bonus > best && hits > 0) { best = hits + bonus; bestCol = c; }
  });
  if (bestCol !== -1) { map.url = bestCol; used.add(bestCol); }
  for (const f of IMPORT_FIELDS) {
    if (f.key === 'url' || !f.re) continue;
    const c = header.findIndex((h, i) => !used.has(i) && f.re.test(h) && !(f.not && f.not.test(h)));
    if (c !== -1) { map[f.key] = c; used.add(c); }
  }
  return map;
}
