/* Fastex Outreach Desk — today.js
   The daily queue: replies first, then tasks grouped by LinkedIn account, pending invites, next 7 days. */
'use strict';

const APP_URL = 'https://claude.ai/artifact/CyC48fDDDMYaUXHywg9HGR';

function gcalRoutineLink(settings) {
  const time = /^\d{2}:\d{2}$/.test(settings.reminderTime || '') ? settings.reminderTime : '09:30';
  const hh = parseInt(time.slice(0, 2), 10), mm = parseInt(time.slice(3), 10);
  const days = (settings.workDays && settings.workDays.length ? settings.workDays : [1, 2, 3, 4, 5]).slice().sort();
  let d = TODAY;
  for (let i = 0; i < 7 && days.indexOf(weekdayOf(d)) === -1; i++) d = addDays(d, 1);
  const endMin = Math.min(hh * 60 + mm + 30, 23 * 60 + 59);
  const stamp = (h, m) => d.replace(/-/g, '') + 'T' + pad2(h) + pad2(m) + '00';
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'LinkedIn outreach run · ' + (settings.agencyName || 'Outreach Desk'),
    details: 'Open the Outreach Desk and clear the Today list: acceptances, replies, follow-ups, then new invites.' + (APP_URL ? '\n\n' + APP_URL : ''),
    dates: stamp(hh, mm) + '/' + stamp(Math.floor(endMin / 60), endMin % 60),
    recur: 'RRULE:FREQ=WEEKLY;BYDAY=' + days.map(x => BY[x]).join(','),
  });
  try { params.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { /* default zone */ }
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

function Meter({ label, v, max }) {
  const ratio = max > 0 ? v / max : 0;
  const cls = ratio >= 1 ? 'meter full' : ratio >= 0.8 ? 'meter warn' : 'meter';
  return html`<span class=${cls} title=${label + ': ' + v + ' of ' + max}>
    <span>${label} <b class="num">${v}/${max}</b></span>
    <span class="meter-track"><span class="meter-fill" style=${{ width: Math.min(100, Math.round(ratio * 100)) + '%' }}></span></span>
  </span>`;
}

function doneLabel(task) {
  if (task.kind === 'reminder') return 'Done';
  const t = task.step && task.step.type;
  if (t === 'connect') return 'Invite sent';
  if (groupOf(t) === 'message') return 'Sent';
  return 'Done';
}

function TaskRow({ task, showClient }) {
  const p = task.p;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const g = task.group;
  const icon = task.kind === 'step' ? (STEP_TYPES[task.step.type] || STEP_TYPES.task).icon : GROUP_ICON[g];
  const sub = roleLine(p);
  const key = acctKeyOf(p);
  const wait = task.kind === 'step' ? cooldownLeft(key) : 0;
  const run = fn => async () => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const isConnect = task.kind === 'step' && task.step.type === 'connect';
  const text = task.kind === 'step' ? String(task.text || '').trim() : '';
  const ph = text ? placeholders(text) : 0;
  const lastReply = task.kind === 'reply' ? (p.log || []).slice().reverse().find(e => e.kind === 'replied') : null;
  let label;
  if (task.kind === 'step') label = task.title;
  else if (task.kind === 'reply') label = 'Replied ' + relDay(task.due, TODAY) + (p.replyAfter ? ' after ' + p.replyAfter.toLowerCase() : '');
  else if (task.kind === 'reminder') label = 'Reminder';
  const openLink = wait > 0 ? html`<button type="button" class="btn sm" disabled title="Short pause between sends on this account"><${Icon} n="clock" s=${14} />Wait ${wait}s</button>` : html`<a class="btn sm" href=${p.url} target="_blank" rel="noopener noreferrer"
      onClick=${text ? () => copyText(text, 'Message copied') : undefined}
      title=${text ? 'Copies the message, then opens their profile' : 'Open their LinkedIn profile'}>
      <${Icon} n=${text ? 'copy' : 'external'} s=${14} />${text ? 'Copy & open' : 'Open profile'}</a>`;
  let actions;
  if (task.kind === 'reply') {
    actions = html`${openLink}
      <button type="button" class="btn sm primary" disabled=${busy} onClick=${() => UI.open('reply', { p, mode: 'outcome' })}><${Icon} n="flag" s=${14} />Log outcome</button>`;
  } else if (task.kind === 'reminder') {
    actions = html`${openLink}
      <button type="button" class="btn sm primary" disabled=${busy} onClick=${run(() => Act.reminderDone(fresh(p)))}><${Icon} n="check" s=${14} />Done</button>`;
  } else {
    actions = html`${openLink}
      <button type="button" class="btn sm primary" disabled=${busy || wait > 0} onClick=${run(() => Act.done(fresh(p)))}><${Icon} n="check" s=${14} />${doneLabel(task)}</button>`;
  }
  return html`<article class=${'task' + (UI.flash === p.clientId + '/' + p.id ? ' flash' : '')} data-pkey=${p.clientId + '/' + p.id}>
    <div class=${'task-icon ' + GROUP_TONE[g]}><${Icon} n=${icon} /></div>
    <div class="task-body">
      <div class="task-top">
        <button type="button" class="task-name" onClick=${() => UI.openProspect(p)}>${fullName(p)}</button>
        ${sub && html`<span class="task-sub">${sub}</span>`}
      </div>
      <div class="task-meta">
        ${showClient && html`<${ClientChip} client=${task.client} />`}
        <span class="task-step">${label}</span>
        ${task.kind !== 'reply' && (task.due < TODAY || task.time) && html`<${Due} due=${task.due} time=${task.time} />`}
        ${task.missing && task.missing.length > 0 && html`<span class="pill tone-overdue" title="These fields are empty on the prospect">Missing ${task.missing.join(', ')}</span>`}
        ${ph > 0 && html`<span class="pill tone-today" title="Replace the [bracketed] text before sending">${plural(ph, 'placeholder')} to edit</span>`}
        ${isConnect && text && html`<${Chars} text=${text} connect=${true} />`}
        ${isConnect && !text && html`<span class="muted" style="font-size:12.5px">No note (fine for most invites)</span>`}
      </div>
      ${task.kind === 'step' && html`<${Journey} p=${p} seq=${task.seq} />`}
      ${text && html`<button type="button" class=${'task-msg' + (open ? '' : ' clamp')} aria-expanded=${open ? 'true' : 'false'} title=${open ? 'Collapse' : 'Show the full message'} onClick=${() => setOpen(!open)}><span class="mt"><${MsgText} text=${text} /></span></button>`}
      ${task.kind === 'step' && !text && task.step.type !== 'connect' && html`<p class="task-note">${(STEP_TYPES[task.step.type] || STEP_TYPES.task).verb}.</p>`}
      ${task.kind === 'reply' && lastReply && lastReply.note && html`<p class="task-note">“${lastReply.note}”</p>`}
      ${task.kind === 'reminder' && html`<p class="task-note">${task.note || 'Follow up with ' + (p.firstName || 'them') + '.'} <span class="muted">(${STATUSES[p.status] ? STATUSES[p.status].label : p.status})</span></p>`}
    </div>
    <div class="task-actions">
      ${actions}
      <${Menu} icon="more" items=${taskMenuItems(Object.assign({}, task, { p: fresh(p) }))} title="More actions" />
    </div>
  </article>`;
}

function AccountGroup({ a, tasks }) {
  const data = currentData();
  const op = memberName(data.settings, a.operatorId);
  const s = a.sender;
  const u = a.usage;
  const dLim = s ? parseInt(s.dailyInvites, 10) || 0 : 0;
  const wLim = s ? parseInt(s.weeklyInvites, 10) || 0 : 0;
  return html`<section class="panel acct" aria-label=${(s ? s.name : 'No account') + ', ' + a.client.name}>
    <header class="acct-head">
      <div class="acct-title">
        <${ClientChip} client=${a.client} />
        <strong>${s ? s.name : 'No LinkedIn account set'}</strong>
        ${op && html`<span class="muted">run by ${op}</span>`}
      </div>
      <div class="acct-meta">
        ${dLim > 0 && html`<${Meter} label="Invites today" v=${u.invitesToday} max=${dLim} />`}
        ${wLim > 0 && html`<${Meter} label="7 days" v=${u.invitesWeek} max=${wLim} />`}
        <span class="num">${plural(u.messagesToday, 'message')} today</span>
      </div>
      ${cooldownLeft(a.key) > 0 && html`<${Countdown} secs=${cooldownLeft(a.key)} total=${cooldownTotal(a.key)} />`}
      <button type="button" class="btn sm" onClick=${() => UI.open('run', { key: a.key })}><${Icon} n="zap" s=${14} />Focus run</button>
    </header>
    ${tasks.map(x => html`<${TaskRow} key=${x.key} task=${x} />`)}
    ${a.overLimit.length > 0 && html`<div class="overflow-note"><${Icon} n="info" s=${14} />
      ${plural(a.overLimit.length, 'more invite')} queued. ${s ? s.name : 'This account'} has used today's invite allowance, so they move to the next working day.</div>`}
  </section>`;
}

function SchedulePanel({ board }) {
  const all = board.accounts.flatMap(a => a.tasks).filter(x => x.due === TODAY);
  const timed = all.filter(x => x.time).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const anytime = all.length - timed.length;
  const now = nowClock();
  const groups = [];
  timed.forEach(x => {
    const label = x.kind === 'reminder' ? 'Reminder' : stepShort(x.seq, x.idx);
    const key = x.time + '|' + x.client.id + '|' + (x.sender ? x.sender.id : '') + '|' + label;
    const g = groups.find(y => y.key === key);
    if (g) g.items.push(x); else groups.push({ key, time: x.time, label, items: [x] });
  });
  const nextG = groups.find(g => g.time > now);
  const nextKey = nextG ? nextG.key : '';
  return html`<section class="panel">
    <div class="panel-head"><h3>Today's schedule</h3><span class="mono muted">${nowClock() && fmtClock(now)}</span></div>
    ${timed.length === 0 ? html`<p class="panel-pad muted" style="font-size:13px">No timed tasks today. Give sequence steps a send time, or snooze and remind with a time, and they line up here.</p>`
      : html`<ul class="agenda">${groups.map(gp => html`<li key=${gp.key} class=${gp.time <= now ? 'past' : gp.key === nextKey ? 'next' : ''}>
          <span class="t mono">${fmtClock(gp.time)}</span>
          ${gp.items.length > 2
            ? html`<button type="button" class="a" onClick=${() => UI.set({ todayFilter: Object.assign({}, UI.todayFilter, { clientId: gp.items[0].client.id }) })}><strong>${gp.items.length} × ${gp.label}</strong><span class="muted">${gp.items[0].client.name} · ${gp.items[0].sender ? gp.items[0].sender.name : ''}</span></button>`
            : html`<div class="a-multi">${gp.items.map(x => html`<button type="button" key=${x.key} class="a" onClick=${() => UI.openProspect(x.p)}><strong>${fullName(x.p)}</strong><span class="muted">${gp.label} · ${x.client.name}</span></button>`)}</div>`}
        </li>`)}</ul>`}
    ${anytime > 0 && html`<p class="panel-pad muted" style="padding-top:${timed.length ? 4 : 0}px;font-size:12.5px">+ ${plural(anytime, 'task')} any time today</p>`}
  </section>`;
}

function stepChip(seq, i) {
  const s = seq.steps[i];
  if (s.type === 'connect') return 'Invite';
  if (s.type === 'message') return 'Msg ' + messageNumber(seq, i);
  return (STEP_TYPES[s.type] || STEP_TYPES.task).short;
}
function Journey({ p, seq }) {
  if (!seq || !seq.steps.length) return null;
  const cur = stepIndexOf(p, seq);
  const open = ['queued', 'active', 'invited'].indexOf(p.status) !== -1;
  const skipped = new Set((p.log || []).filter(e => e.kind === 'skipped').map(e => e.stepId));
  const chips = [];
  seq.steps.forEach((st, i) => {
    let state = i < cur ? (skipped.has(st.id) ? 'skip' : 'done') : i === cur && open && p.status !== 'invited' ? 'now' : 'next';
    chips.push({ key: st.id, label: stepChip(seq, i), state });
    if (st.type === 'connect') {
      const accepted = !!(p.acceptedOn || p.alreadyConnected);
      chips.push({ key: st.id + ':gate', label: accepted ? 'Accepted' : p.status === 'invited' ? 'Waiting to accept' : 'Accept', state: accepted ? 'done' : p.status === 'invited' ? 'wait' : 'next', gate: true });
    }
  });
  let nowLabel = 'now';
  if (open && p.status !== 'invited' && cur < seq.steps.length) {
    const due = stepDue(p, seq, cur, currentData().settings);
    if (due > TODAY) nowLabel = 'next, ' + fmtShort(due);
    else if (due < TODAY) nowLabel = 'overdue';
  }
  if (!open) chips.push({ key: 'end', label: (STATUSES[p.status] || {}).label || p.status, state: 'end' });
  return html`<ol class="journey" aria-label="Sequence progress">
    ${chips.map(c => html`<li key=${c.key} class=${'j-' + c.state + (c.gate ? ' j-gate' : '')}>${c.state === 'done' ? html`<${Icon} n="check" s=${11} />` : c.state === 'wait' ? html`<${Icon} n="clock" s=${11} />` : ''}${c.label}${c.state === 'now' ? ' · ' + nowLabel : ''}</li>`)}
  </ol>`;
}

function flashTask(p) {
  UI.set({ todayFilter: Object.assign({}, UI.todayFilter, { tab: 'todo', group: 'all' }), flash: p.clientId + '/' + p.id });
  setTimeout(() => {
    const el = document.querySelector('[data-pkey="' + p.clientId + '/' + p.id + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
  setTimeout(() => { if (UI.flash === p.clientId + '/' + p.id) UI.set({ flash: null }); }, 4000);
}
async function acceptAndGuide(p, on) {
  const ok = await Act.accept(p, on);
  if (!ok) return;
  const q = fresh(p);
  const seq = seqFor(q);
  if (q.status === 'active' && seq) {
    const i = stepIndexOf(q, seq);
    const due = stepDue(q, seq, i, currentData().settings);
    UI.toasts = UI.toasts.slice(0, -1);
    UI.toast(fullName(q) + ' accepted. ' + stepShort(seq, i) + (due <= TODAY ? ' is ready to send now.' : ' is scheduled for ' + fmtDay(due) + '.'),
      { undo: () => W.saveProspect(p), action: due <= TODAY ? { label: 'Go to ' + stepShort(seq, i), run: () => flashTask(q) } : null });
  }
}

function WaitingRow({ task }) {
  const p = task.p;
  const [busy, setBusy] = useState(false);
  const stale = task.stale;
  return html`<article class="task" data-pkey=${p.clientId + '/' + p.id}>
    <div class=${'task-icon ' + (stale ? 'tone-overdue' : 'tone-info')}><${Icon} n="clock" /></div>
    <div class="task-body">
      <div class="task-top">
        <button type="button" class="task-name" onClick=${() => UI.openProspect(p)}>${fullName(p)}</button>
        <span class="task-sub">${roleLine(p)}</span>
      </div>
      <div class="task-meta">
        <span class="task-step">Invite sent ${relDay(p.invitedOn || task.due, TODAY)}${p.invitedOn ? ' (' + fmtDay(p.invitedOn) + ')' : ''}</span>
        ${stale && html`<span class="pill tone-overdue">No answer for ${task.pendingDays} days. Consider withdrawing</span>`}
      </div>
      <${Journey} p=${p} seq=${task.seq} />
    </div>
    <div class="task-actions">
      <a class="btn sm" href=${p.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external" s=${14} />Open profile</a>
      <button type="button" class="btn sm primary" disabled=${busy} title="They now show as a connection on LinkedIn" onClick=${async () => { setBusy(true); try { await acceptAndGuide(fresh(p), TODAY); } finally { setBusy(false); } }}><${Icon} n="userCheck" s=${14} />Accepted</button>
      <${Menu} icon="more" items=${[
        { label: 'Accepted on an earlier day…', icon: 'calendar', onSelect: () => UI.open('date', { title: 'When did ' + (p.firstName || 'they') + ' accept?', sub: 'Message 1 is scheduled from this date.', confirmLabel: 'Mark accepted', withTime: true, timeLabel: 'At (optional)', presets: [{ label: 'Today', value: TODAY }, { label: 'Yesterday', value: addDays(TODAY, -1) }, { label: '2 days ago', value: addDays(TODAY, -2) }], onConfirm: d => acceptAndGuide(fresh(p), d) }) },
        { label: 'They replied to the invite…', icon: 'reply', onSelect: () => UI.open('reply', { p: fresh(p) }) },
        { label: 'Not yet, check again in a week', icon: 'clock', onSelect: () => Act.snooze(fresh(p), addDays(TODAY, 7)) },
        { label: 'Withdraw invite…', icon: 'logout', onSelect: () => openWithdraw(fresh(p)) },
        { divider: true },
        { label: 'Open details', icon: 'user', onSelect: () => UI.openProspect(p) },
      ]} />
    </div>
  </article>`;
}

function WaitingTab({ board, settings }) {
  const accts = board.accounts.filter(a => a.pending.length);
  if (!accts.length) return html`<div class="panel"><${Empty} icon="userCheck" title="Nobody is waiting">When you send a connection request it shows up here until you mark the person as accepted.</${Empty}></div>`;
  return html`<div class="stack-lg">
    <div class="steps-strip">
      <div><span class="n">1</span>Open LinkedIn as the account below → <a href=${LINKEDIN_LINKS.connections} target="_blank" rel="noopener noreferrer">My Network → Connections</a>, sorted by "Recently added".</div>
      <div><span class="n">2</span>Anyone here who now shows as a connection: click <strong>Accepted</strong>.</div>
      <div><span class="n">3</span>Their <strong>Message 1</strong> moves to <strong>To do</strong> right away, ready to send.</div>
    </div>
    ${accts.map(a => html`<section class="panel acct" key=${a.key}>
      <header class="acct-head">
        <div class="acct-title"><${ClientChip} client=${a.client} /><strong>${a.sender ? a.sender.name : 'No LinkedIn account set'}</strong>
          <span class="muted">${plural(a.pending.length, 'person', 'people')} waiting${a.stale.length ? ' · ' + a.stale.length + ' over ' + settings.staleDays + ' days' : ''}</span></div>
        <button type="button" class="btn sm" onClick=${() => UI.open('accept', { key: a.key })}><${Icon} n="checkSquare" s=${14} />Tick several at once</button>
      </header>
      ${a.pending.map(x => html`<${WaitingRow} key=${x.key} task=${x} />`)}
    </section>`)}
  </div>`;
}

function UpcomingTab({ board }) {
  if (!board.upcoming.length) return html`<div class="panel"><${Empty} icon="calendar" title="Nothing scheduled in the next 14 days">New steps appear here as invites get accepted and messages go out.</${Empty}></div>`;
  return html`<div class="stack-lg">${board.upcoming.map(day => html`<section class="panel acct" key=${day.date}>
    <header class="acct-head"><div class="acct-title"><strong>${fmtLong(day.date)}</strong><span class="muted">${relDay(day.date, TODAY)} · ${plural(day.tasks.length, 'task')}</span></div></header>
    ${day.tasks.slice().sort(taskOrder).map(x => html`<article class="task" key=${x.key}>
      <div class=${'task-icon ' + GROUP_TONE[x.group]}><${Icon} n=${x.kind === 'step' ? (STEP_TYPES[x.step.type] || STEP_TYPES.task).icon : GROUP_ICON[x.group]} /></div>
      <div class="task-body">
        <div class="task-top"><button type="button" class="task-name" onClick=${() => UI.openProspect(x.p)}>${fullName(x.p)}</button><span class="task-sub">${roleLine(x.p)}</span></div>
        <div class="task-meta">
          <${ClientChip} client=${x.client} /><span class="task-step">${x.kind === 'reminder' ? 'Reminder' + (x.note ? ': ' + x.note : '') : x.title}</span>
          ${x.time && html`<span class="pill tone-neutral"><${Icon} n="clock" s=${11} />${fmtClock(x.time)}</span>`}
          <span class="muted" style="font-size:12.5px">${x.sender ? 'from ' + x.sender.name : ''}</span>
        </div>
        ${x.kind === 'step' && html`<${Journey} p=${x.p} seq=${x.seq} />`}
      </div>
      <div class="task-actions">
        <button type="button" class="btn sm" onClick=${() => UI.openProspect(x.p)}>Details</button>
        <${Menu} icon="more" items=${taskMenuItems(Object.assign({}, x, { p: fresh(x.p) }))} />
      </div>
    </article>`)}
  </section>`)}</div>`;
}

function DoneTab({ data, f }) {
  const rows = useMemo(() => {
    const out = [];
    for (const p of data.prospects) {
      const c = data.clients[p.clientId];
      if (!c) continue;
      if (f.clientId && p.clientId !== f.clientId) continue;
      if (f.clientId && f.listId && (f.listId === '_none' ? p.listId : p.listId !== f.listId)) continue;
      const sender = senderOf(c, p);
      if (f.operatorId && operatorOf(c, sender) !== f.operatorId) continue;
      for (const e of p.log || []) if (e.on === TODAY && e.kind !== 'added') out.push({ e, p, c, sender });
    }
    return out.sort((a, b) => ((a.e.ts || '') < (b.e.ts || '') ? 1 : -1));
  }, [data, TODAY, f.clientId, f.listId, f.operatorId]);
  if (!rows.length) return html`<div class="panel"><${Empty} icon="check" title="Nothing logged yet today">Everything you mark as sent, accepted or replied shows up here with the time.</${Empty}></div>`;
  return html`<section class="panel">
    <div class="panel-head"><h3>Done today</h3><span class="mono muted">${rows.length}</span></div>
    <ul class="acts feed">${rows.map((x, i) => {
      const k = ACTIVITY_KINDS[activityKind(x.e)];
      return html`<li class="act" key=${i}>
        <span class="act-time mono">${x.e.ts ? fmtTime(x.e.ts) : '–'}</span>
        <span class=${'act-ic tone-' + k.tone}><${Icon} n=${k.icon} s=${13} /></span>
        <div class="act-body">
          <div class="act-text"><button type="button" class="linkish strong" onClick=${() => UI.openProspect(x.p)}>${fullName(x.p)}</button> <span class="muted">· ${x.sender ? x.sender.name : ''}</span></div>
          <div class="act-text">${activityText(x.e)}${x.e.by && memberName(data.settings, x.e.by) ? html` <span class="muted">· by ${memberName(data.settings, x.e.by)}</span>` : ''}</div>
          ${activityNote(x.e) && html`<div class="act-note">${activityNote(x.e)}</div>`}
        </div>
        <span class="act-client"><${ClientChip} client=${x.c} /></span>
      </li>`;
    })}</ul>
  </section>`;
}

function TodayView() {
  const data = currentData();
  const f = UI.todayFilter;
  const tab = f.tab || 'todo';
  const board = useMemo(() => buildBoard(data, { today: TODAY, clientId: f.clientId, operatorId: f.operatorId, listId: f.clientId ? f.listId : '' }), [data, TODAY, f.clientId, f.operatorId, f.listId]);
  const setF = patch => UI.set({ todayFilter: Object.assign({}, f, patch) });
  const c = board.counts;
  const g = f.group || 'all';
  const match = x => g === 'all' || (g === 'overdue' ? x.due < TODAY : x.group === g);
  const accounts = board.accounts.map(a => ({ a, tasks: a.tasks.filter(match) })).filter(x => x.tasks.length || (g === 'all' && x.a.overLimit.length));
  const showReplies = (g === 'all' || g === 'reply') && board.replies.length > 0;
  const todo = c.replies + c.overdue + c.dueToday;
  const total = c.doneToday + todo;
  const progress = total > 0 ? Math.round((c.doneToday / total) * 100) : 0;
  const noClients = Object.keys(data.clients).length === 0;
  const go = (t, patch) => setF(Object.assign({ tab: t }, patch || {}));
  const stat = (label, v, color, onClick, on) => html`<button type="button" class="stat" aria-pressed=${on ? 'true' : 'false'} onClick=${onClick}>
    <span class="k"><span class="dot" style=${{ background: color }}></span>${label}</span><span class="v">${fmtNum(v)}</span></button>`;
  const types = [['all', 'All'], ['reply', 'Replies'], ['message', 'Messages'], ['invite', 'Invites'], ['touch', 'Touches'], ['reminder', 'Reminders'], ['overdue', 'Overdue']];
  const tabs = [['todo', 'To do', todo], ['waiting', 'Waiting for acceptance', c.pending], ['upcoming', 'Upcoming', c.upcoming], ['done', 'Done today', c.doneToday]];

  return html`<div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">${fmtLong(TODAY)}</p>
        <h1>Today</h1>
        <p class="lede">${todo === 0 ? 'Nothing left to do right now.' : plural(todo, 'thing') + ' to do' + (c.overdue ? ', ' + c.overdue + ' overdue' : '')}${c.pending ? ' · ' + plural(c.pending, 'invite') + ' waiting for acceptance' : ''}.</p>
      </div>
      <div class="head-actions">
        <${HelpButton} view="today" />
        <button type="button" class="btn" onClick=${() => copyText(planText(board, data), "Today's plan")}><${Icon} n="copy" s=${14} />Copy plan</button>
        <button type="button" class="btn primary" disabled=${todo === 0} onClick=${() => UI.open('run', { key: '' })}><${Icon} n="zap" s=${14} />Focus run</button>
      </div>
    </header>

    ${noClients ? html`<div class="panel"><${Empty} icon="briefcase" title="Add your first client"
        action=${html`<div class="btn-row" style="justify-content:center"><${HelpButton} view="today" /><button type="button" class="btn primary" onClick=${() => UI.open('client', {})}><${Icon} n="plus" s=${14} />Add client</button></div>`}>
        Each client gets one or more LinkedIn sending accounts. Then add prospects and this page fills itself.</${Empty}></div>` : html`

    <div class="stats">
      ${stat('Replies waiting', c.replies, 'var(--reply)', () => go('todo', { group: g === 'reply' && tab === 'todo' ? 'all' : 'reply' }), tab === 'todo' && g === 'reply')}
      ${stat('Overdue', c.overdue, 'var(--overdue)', () => go('todo', { group: g === 'overdue' && tab === 'todo' ? 'all' : 'overdue' }), tab === 'todo' && g === 'overdue')}
      ${stat('Due today', c.dueToday, 'var(--today)', () => go('todo', { group: 'all' }), false)}
      ${stat('Waiting for acceptance', c.pending, 'var(--info)', () => go('waiting'), tab === 'waiting')}
      ${stat('Done today', c.doneToday, 'var(--good)', () => go('done'), tab === 'done')}
    </div>

    <div class="progress" aria-label="Today's progress">
      <div class="progress-track"><div class="progress-fill" style=${{ width: progress + '%' }}></div></div>
      <span class="progress-text num">${c.doneToday} done · ${todo} to go</span>
    </div>

    <div class="tabs big" role="tablist">
      ${tabs.map(([k, l, n]) => html`<button type="button" role="tab" key=${k} aria-selected=${tab === k ? 'true' : 'false'} onClick=${() => go(k)}>${l}<span class="n">${n}</span></button>`)}
    </div>

    <div class="toolbar">
      <${ClientSelect} id="today-client" cls="select sm" data=${data} value=${f.clientId} all=${true} onChange=${v => setF({ clientId: v, listId: '' })} />
      ${f.clientId && listsOf(data, f.clientId).length > 0 && html`<${ListSelect} id="today-list" cls="select sm" data=${data} clientId=${f.clientId} value=${f.listId} allLabel="All lists" onChange=${v => setF({ listId: v })} />`}
      <${MemberSelect} id="today-member" cls="select sm" settings=${data.settings} value=${f.operatorId} all=${true} allLabel="All team members" onChange=${v => setF({ operatorId: v })} />
      ${tab === 'todo' && html`<div class="seg" role="group" aria-label="Task type">
        ${types.map(([k, l]) => html`<button type="button" key=${k} aria-pressed=${g === k ? 'true' : 'false'} onClick=${() => setF({ group: k })}>${l}</button>`)}
      </div>`}
    </div>

    ${board.hiddenClients.length > 0 && html`<p class="muted" style="font-size:12.5px">${plural(board.hiddenClients.length, 'paused client')} hidden: ${board.hiddenClients.map(id => (data.clients[id] || {}).name).join(', ')}.</p>`}

    ${tab === 'waiting' ? html`<${WaitingTab} board=${board} settings=${data.settings} />`
      : tab === 'upcoming' ? html`<${UpcomingTab} board=${board} />`
      : tab === 'done' ? html`<${DoneTab} data=${data} f=${f} />`
      : html`<div class="today-grid">
      <div class="stack-lg">
        ${showReplies && html`<section class="panel acct">
          <header class="acct-head"><div class="acct-title"><span class="pill tone-reply"><${Icon} n="reply" s=${12} />Replies waiting</span><span class="muted">Answer these first. The sequence has stopped for each of them.</span></div></header>
          ${board.replies.map(x => html`<${TaskRow} key=${x.key} task=${x} showClient=${true} />`)}
        </section>`}
        ${accounts.map(x => html`<${AccountGroup} key=${x.a.key} a=${x.a} tasks=${x.tasks} />`)}
        ${!showReplies && accounts.length === 0 && html`<div class="panel"><${Empty} icon="check" title=${g === 'all' ? 'All done for now' : 'Nothing of this type is due'}
            action=${html`<div class="btn-row" style="justify-content:center">
              ${c.pending > 0 && html`<button type="button" class="btn" onClick=${() => go('waiting')}>Check ${plural(c.pending, 'pending invite')}</button>`}
              ${c.upcoming > 0 && html`<button type="button" class="btn" onClick=${() => go('upcoming')}>See upcoming</button>`}</div>`}>
          ${c.upcoming ? plural(c.upcoming, 'task') + ' coming up in the next 14 days.' : 'Add prospects to keep the pipeline moving.'}</${Empty}></div>`}
      </div>
      <aside class="today-side">
        <${SchedulePanel} board=${board} />
        ${c.pending > 0 && html`<section class="panel panel-pad stack">
          <div class="task-meta"><span class="pill tone-info"><${Icon} n="clock" s=${12} />${plural(c.pending, 'invite')} waiting</span>${c.stale > 0 && html`<span class="pill tone-overdue">${c.stale} stale</span>`}</div>
          <p class="soft" style="font-size:13px">Mark people as Accepted once they connect, so their first message comes up here.</p>
          <button type="button" class="btn sm" style="align-self:flex-start" onClick=${() => go('waiting')}><${Icon} n="userCheck" s=${14} />Record acceptances</button>
        </section>`}
      </aside>
    </div>`}`}
  </div>`;
}

/* ---------- acceptance check ---------- */
function AcceptanceModal({ accountKey }) {
  const data = currentData();
  const board = useMemo(() => buildBoard(data, { today: TODAY }), [data, TODAY]);
  const a = board.accounts.find(x => x.key === accountKey);
  const [sel, setSel] = useState(() => new Set());
  const [when, setWhen] = useState(TODAY);
  const [remind, setRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = a ? a.pending : [];
  const toggle = k => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); setSel(n); };
  const chosen = list.filter(x => sel.has(x.key));
  const accept = async () => {
    setBusy(true);
    await Act.bulk(chosen.map(x => fresh(x.p)), p => actAccept(p, seqFor(p), when, me()), n => plural(n, 'prospect') + ' marked accepted. Their first messages are now in To do.');
    setSel(new Set()); setBusy(false);
  };
  const withdraw = async () => {
    setBusy(true);
    await Act.bulk(chosen.map(x => fresh(x.p)), p => actWithdraw(p, TODAY, me(), remind ? addDays(TODAY, 21) : null), n => plural(n, 'invite') + ' marked withdrawn.');
    setSel(new Set()); setBusy(false);
  };
  const presets = [{ label: 'Today', value: TODAY }, { label: 'Yesterday', value: addDays(TODAY, -1) }, { label: '2 days ago', value: addDays(TODAY, -2) }];
  return html`<${Modal} title="Check acceptances" size="wide"
    sub=${a ? (a.sender ? a.sender.name : 'No account') + ' · ' + a.client.name + ' · ' + plural(list.length, 'invite') + ' waiting' : 'Nothing pending'}
    foot=${html`
      <label class="check left"><input id="acc-remind" type="checkbox" checked=${remind} onChange=${e => setRemind(e.target.checked)} />Remind me to re-invite withdrawn people in 3 weeks</label>
      <button type="button" class="btn" disabled=${!chosen.length || busy} onClick=${withdraw}><${Icon} n="logout" s=${14} />Withdraw ${chosen.length || ''}</button>
      <button type="button" class="btn primary" disabled=${!chosen.length || busy} onClick=${accept}><${Icon} n="userCheck" s=${14} />Mark ${chosen.length || ''} accepted</button>`}>
    ${!a || !list.length ? html`<${Empty} icon="check" title="No pending invites">Everyone on this account has accepted, replied or been withdrawn.</${Empty}>` : html`
      <div class="note-box">Log in as <strong>${a.sender ? a.sender.name : 'this account'}</strong>, open My Network, and tick everyone who now shows as a connection.
        <a href=${LINKEDIN_LINKS.connections} target="_blank" rel="noopener noreferrer">Open Connections</a> ·
        <a href=${LINKEDIN_LINKS.sent} target="_blank" rel="noopener noreferrer">Open Sent invitations</a>.
        Withdraw on LinkedIn first, then log it here.</div>
      <div class="toolbar">
        <span class="label">Accepted on</span>
        <div class="seg" role="group" aria-label="Acceptance date">
          ${presets.map(x => html`<button type="button" key=${x.label} aria-pressed=${when === x.value ? 'true' : 'false'} onClick=${() => setWhen(x.value)}>${x.label}</button>`)}
        </div>
        <input id="acc-date" type="date" class="input sm" style="width:auto" value=${when} onInput=${e => setWhen(e.target.value)} />
        <span style="flex:1"></span>
        <button type="button" class="btn sm ghost" onClick=${() => setSel(new Set(list.map(x => x.key)))}>Select all</button>
        ${a.stale.length > 0 && html`<button type="button" class="btn sm ghost" onClick=${() => setSel(new Set(a.stale.map(x => x.key)))}>Select ${a.stale.length} stale</button>`}
        ${sel.size > 0 && html`<button type="button" class="btn sm ghost" onClick=${() => setSel(new Set())}>Clear</button>`}
      </div>
      <div class="checklist">
        ${list.map(x => html`<label key=${x.key}>
          <input type="checkbox" checked=${sel.has(x.key)} onChange=${() => toggle(x.key)} />
          <span style="min-width:0"><strong>${fullName(x.p)}</strong> <span class="muted">${roleLine(x.p)}</span></span>
          <span class="btn-row" style="gap:6px;flex-wrap:nowrap">
            ${x.stale && html`<span class="pill tone-overdue">stale</span>`}
            <span class="mono muted">${x.pendingDays}d</span>
            <a class="btn sm ghost icon" href=${x.p.url} target="_blank" rel="noopener noreferrer" aria-label=${'Open ' + fullName(x.p) + ' on LinkedIn'}><${Icon} n="external" s=${14} /></a>
          </span>
        </label>`)}
      </div>`}
  <//>`;
}

/* ---------- focus run: one task at a time ---------- */
/* Profile details shown in Focus run, editable on the spot. */
function ProfileStrip({ p, missing }) {
  const [edit, setEdit] = useState(false);
  const init = () => ({ position: p.position || '', company: p.company || '', title: p.title || '', location: p.location || '' });
  const [v, setV] = useState(init);
  useEffect(() => { setV(init()); setEdit(false); }, [p.id]);
  const needs = (missing || []).length > 0 || (!p.company && !p.position);
  const save = async () => {
    const patch = { position: v.position.trim(), company: v.company.trim(), title: v.title.trim(), location: v.location.trim() };
    if (await Act.update(fresh(p), patch, 'Details saved for ' + fullName(p) + '.')) setEdit(false);
  };
  const applyPaste = d => setV(Object.assign({}, v, { position: d.position || v.position, company: d.company || v.company, title: d.title || v.title, location: d.location || v.location }));
  if (!edit) {
    return html`<div class=${'profile-strip' + (needs ? ' needs' : '')}>
      <dl>
        <div><dt>Position</dt><dd>${p.position || positionFromHeadline(p.title) || html`<span class="muted">not set</span>`}</dd></div>
        <div><dt>Company</dt><dd>${p.company || html`<span class="muted">not set</span>`}</dd></div>
        <div><dt>Headline</dt><dd>${p.title || html`<span class="muted">not set</span>`}</dd></div>
        <div><dt>Location</dt><dd>${p.location || html`<span class="muted">not set</span>`}</dd></div>
      </dl>
      <button type="button" class=${'btn sm' + (needs ? ' primary' : '')} onClick=${() => setEdit(true)}><${Icon} n="edit" s=${14} />${needs ? 'Add details' : 'Edit'}</button>
    </div>`;
  }
  return html`<div class="profile-strip editing">
    <${ProfilePaste} onApply=${applyPaste} />
    <div class="fields">
      <label class="field"><span>Position</span><input id="ps-pos" class="input sm" value=${v.position} onInput=${e => setV(Object.assign({}, v, { position: e.target.value }))} /></label>
      <label class="field"><span>Company</span><input id="ps-co" class="input sm" value=${v.company} onInput=${e => setV(Object.assign({}, v, { company: e.target.value }))} /></label>
      <label class="field full"><span>Headline</span><input id="ps-hl" class="input sm" value=${v.title} onInput=${e => setV(Object.assign({}, v, { title: e.target.value }))} /></label>
      <label class="field full"><span>Location</span><input id="ps-loc" class="input sm" value=${v.location} onInput=${e => setV(Object.assign({}, v, { location: e.target.value }))} /></label>
    </div>
    <div class="btn-row"><button type="button" class="btn sm primary" onClick=${save}>Save details</button><button type="button" class="btn sm ghost" onClick=${() => { setV(init()); setEdit(false); }}>Cancel</button></div>
  </div>`;
}

function RunModal({ accountKey }) {
  const data = currentData();
  const board = useMemo(() => buildBoard(data, { today: TODAY, clientId: accountKey ? '' : UI.todayFilter.clientId, operatorId: accountKey ? '' : UI.todayFilter.operatorId }), [data, TODAY]);
  const [skipped, setSkipped] = useState(() => new Set());
  const [doneKeys, setDoneKeys] = useState(() => new Set());
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const accs = accountKey ? board.accounts.filter(a => a.key === accountKey) : board.accounts;
  const queue = accs.flatMap(a => a.tasks).filter(x => !skipped.has(x.key) && !doneKeys.has(x.key));
  const task = queue[0];
  const text = task && task.kind === 'step' ? String(task.text || '') : '';
  useEffect(() => { setDraft(text); }, [task ? task.key : '']);
  const title = accountKey && accs[0] ? 'Focus run · ' + (accs[0].sender ? accs[0].sender.name : accs[0].client.name) : 'Focus run';
  const act = fn => async () => {
    if (busy || !task) return;
    setBusy(true);
    const k = task.key;
    try { const ok = await fn(); if (ok !== false) { setDoneKeys(s => new Set(s).add(k)); setCount(n => n + 1); } }
    finally { setBusy(false); }
  };
  const skip = () => { if (task) setSkipped(s => new Set(s).add(task.key)); };
  if (!task) {
    return html`<${Modal} title=${title} size="narrow" foot=${html`<button type="button" class="btn primary" onClick=${() => UI.close()}>Close</button>`}>
      <${Empty} icon="check" title=${count ? 'Run complete' : 'Nothing due here'}>${count ? plural(count, 'task') + ' done in this run.' + (skipped.size ? ' ' + skipped.size + ' skipped for now.' : '') : 'No tasks are due for this selection.'}</${Empty}>
    <//>`;
  }
  const p = task.p;
  const isStep = task.kind === 'step';
  const wait = isStep ? cooldownLeft(acctKeyOf(p)) : 0;
  return html`<${Modal} title=${title} size="wide" foot=${html`
      <span class="left run-progress">${count} done · ${queue.length} to go</span>
      <button type="button" class="btn" disabled=${busy} onClick=${() => UI.open('reply', { p: fresh(p), back: { type: 'run', props: { key: accountKey } } })}><${Icon} n="reply" s=${14} />They replied</button>
      ${isStep && html`<button type="button" class="btn" disabled=${busy} onClick=${act(() => Act.snooze(fresh(p), addDays(TODAY, 1)))}><${Icon} n="clock" s=${14} />Tomorrow</button>`}
      <button type="button" class="btn" disabled=${busy} onClick=${skip}><${Icon} n="skip" s=${14} />Later</button>
      <button type="button" class="btn primary" disabled=${busy || wait > 0} onClick=${act(() => task.kind === 'reminder' ? Act.reminderDone(fresh(p)) : Act.done(fresh(p)))}><${Icon} n="check" s=${14} />${wait > 0 ? 'Wait ' + wait + 's' : doneLabel(task) + ' · next'}</button>`}>
    <div class="run-card">
      <div>
        <div class="task-meta" style="margin-bottom:8px"><${ClientChip} client=${task.client} /><span class="task-step">${task.sender ? task.sender.name : ''}</span></div>
        <div class="run-name">${fullName(p)}</div>
        <div class="muted">${roleLine(p) || 'No position or company yet'}</div>
      </div>
      <${ProfileStrip} p=${fresh(p)} missing=${task.missing} />
      ${wait > 0 && html`<div class="pace-banner"><${Countdown} secs=${wait} total=${cooldownTotal(acctKeyOf(p))} label="Short pause before the next send:" /><span class="muted">A random ${pacingSettings().min}–${pacingSettings().max} second gap between sends keeps this account's activity looking human. Read the profile meanwhile.</span></div>`}
      <div class="task-meta">
        <span class=${'pill ' + GROUP_TONE[task.group]}><${Icon} n=${isStep ? (STEP_TYPES[task.step.type] || STEP_TYPES.task).icon : GROUP_ICON[task.group]} s=${12} />${isStep ? task.title : 'Reminder'}</span>
        <${Due} due=${task.due} time=${task.time} />
        ${task.missing && task.missing.length > 0 && html`<span class="pill tone-overdue">Missing ${task.missing.join(', ')}</span>`}
        ${isStep && task.step.type === 'connect' && draft.trim() && html`<${Chars} text=${draft} connect=${true} />`}
      </div>
      ${isStep && text.trim() ? html`
        <label class="field"><span>Message <span class="hint">edits here are only for this send</span></span>
          <textarea id="run-draft" class="textarea run-msg" value=${draft} onInput=${e => setDraft(e.target.value)}></textarea></label>
        ${placeholders(draft) > 0 && html`<div class="note-box warn">Replace the [bracketed] placeholders before sending.</div>`}
        <div class="btn-row">
          ${wait > 0 ? html`<button type="button" class="btn primary" disabled><${Icon} n="clock" s=${14} />Copy & open in ${wait}s</button>`
            : html`<a class="btn primary" href=${p.url} target="_blank" rel="noopener noreferrer" onClick=${() => copyText(draft, 'Message copied')}><${Icon} n="copy" s=${14} />Copy & open profile</a>`}
          <button type="button" class="btn" onClick=${() => copyText(draft, 'Message copied')}><${Icon} n="copy" s=${14} />Copy only</button>
        </div>`
      : html`
        <div class="note-box">${isStep ? (STEP_TYPES[task.step.type] || STEP_TYPES.task).verb + '.' : (task.note || 'Follow up with ' + (p.firstName || 'them') + '.')}</div>
        <div class="btn-row"><a class="btn primary" href=${p.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external" s=${14} />Open profile</a></div>`}
    </div>
  <//>`;
}

/* ---------- replies & outcomes ---------- */
function ReplyModal({ p: p0, mode, back }) {
  const p = fresh(p0);
  const isOutcome = mode === 'outcome';
  const [on, setOn] = useState(TODAY);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState(isOutcome ? 'interested' : 'replied');
  const [follow, setFollow] = useState(addDays(TODAY, 2));
  const [nurture, setNurture] = useState(addDays(TODAY, 30));
  const [meetingOn, setMeetingOn] = useState(addDays(TODAY, 3));
  const [meetRemind, setMeetRemind] = useState(true);
  const options = [
    !isOutcome && { v: 'replied', label: 'I need to answer them', hint: 'Pinned to the top of Today until you log an outcome.' },
    { v: 'interested', label: 'Interested', hint: 'Positive reply. Set when to follow up.' },
    { v: 'meeting', label: 'Meeting booked', hint: 'The goal. Counted in reports.' },
    { v: 'nurture', label: 'Not now, follow up later', hint: 'Reminder on a date you pick.' },
    { v: 'not_interested', label: 'Not interested', hint: 'Closes the prospect.' },
    isOutcome && { v: 'resume', label: 'Resume the sequence', hint: 'It was an auto-reply or out-of-office.' },
  ].filter(Boolean);
  const finish = () => { if (back) UI.open(back.type, back.props); else UI.close(); };
  const submit = async e => {
    if (e) e.preventDefault();
    const opts = {};
    if (outcome === 'interested') { opts.followUpOn = follow; opts.followUpNote = 'Follow up on their interest'; }
    if (outcome === 'nurture') { opts.followUpOn = nurture; opts.followUpNote = 'Check back in'; }
    if (outcome === 'meeting') { opts.meetingOn = meetingOn; if (meetRemind) { opts.followUpOn = meetingOn; opts.followUpNote = 'Meeting today. Confirm and send the agenda.'; } }
    if (outcome === 'not_interested' || outcome === 'meeting') { if (!meetRemind || outcome === 'not_interested') { opts.followUpOn = null; } }
    if (isOutcome && note.trim()) opts.note = note.trim();
    finish();
    if (outcome === 'resume') await Act.resume(p);
    else if (isOutcome) await Act.outcome(p, outcome, opts);
    else await Act.reply(p, on, note.trim(), outcome, opts);
  };
  return html`<${Modal} title=${isOutcome ? 'Log the outcome' : 'Log a reply'} sub=${fullName(p) + (p.company ? ' · ' + p.company : '')} onClose=${finish}
    foot=${html`<button type="button" class="btn" onClick=${finish}>Cancel</button><button type="submit" form="reply-form" class="btn primary">Save</button>`}>
    <form id="reply-form" class="stack" onSubmit=${submit}>
      ${!isOutcome && html`<div class="fields">
        <label class="field"><span>Replied on</span><input id="reply-on" type="date" class="input" value=${on} onInput=${e => setOn(e.target.value)} /></label>
        <div class="field"><span>Quick pick</span><div class="seg">
          <button type="button" aria-pressed=${on === TODAY ? 'true' : 'false'} onClick=${() => setOn(TODAY)}>Today</button>
          <button type="button" aria-pressed=${on === addDays(TODAY, -1) ? 'true' : 'false'} onClick=${() => setOn(addDays(TODAY, -1))}>Yesterday</button>
        </div></div>
      </div>`}
      <label class="field"><span>${isOutcome ? 'Note (optional)' : 'What did they say? (optional)'}</span>
        <textarea id="reply-note" class="textarea" style="min-height:64px" placeholder="Asked for pricing and a case study" value=${note} onInput=${e => setNote(e.target.value)}></textarea></label>
      <fieldset class="field" style="border:0;padding:0;margin:0">
        <span class="label">${isOutcome ? 'Outcome' : 'Where does this leave them?'}</span>
        <div class="checklist" style="max-height:none">
          ${options.map(o => html`<label key=${o.v}>
            <input type="radio" name="outcome" checked=${outcome === o.v} onChange=${() => setOutcome(o.v)} />
            <span><strong>${o.label}</strong><br /><span class="muted" style="font-size:12.5px">${o.hint}</span></span><span></span>
          </label>`)}
        </div>
      </fieldset>
      ${outcome === 'interested' && html`<label class="field"><span>Follow up on</span><input id="reply-follow" type="date" class="input" value=${follow} onInput=${e => setFollow(e.target.value)} /></label>`}
      ${outcome === 'nurture' && html`<label class="field"><span>Follow up on</span><input id="reply-nurture" type="date" class="input" value=${nurture} onInput=${e => setNurture(e.target.value)} /></label>`}
      ${outcome === 'meeting' && html`<div class="fields">
        <label class="field"><span>Meeting date</span><input id="reply-meeting" type="date" class="input" value=${meetingOn} onInput=${e => setMeetingOn(e.target.value)} /></label>
        <label class="check" style="align-self:end"><input id="reply-meet-remind" type="checkbox" checked=${meetRemind} onChange=${e => setMeetRemind(e.target.checked)} />Remind me on the day</label>
      </div>`}
    </form>
  <//>`;
}

function WithdrawModal({ p: p0 }) {
  const p = fresh(p0);
  const [remind, setRemind] = useState(true);
  const days = p.invitedOn ? daysBetween(p.invitedOn, TODAY) : 0;
  return html`<${Modal} title="Withdraw invite" sub=${fullName(p) + ' · pending ' + plural(days, 'day')} size="narrow"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>
      <button type="button" class="btn primary" onClick=${() => { UI.close(); Act.withdraw(p, remind ? addDays(TODAY, 21) : null); }}>Mark withdrawn</button>`}>
    <p class="soft">Withdraw it on LinkedIn first (My Network → Manage → Sent), then log it here. Old pending invites count against the account, so clearing them keeps it healthy.</p>
    <p><a href=${LINKEDIN_LINKS.sent} target="_blank" rel="noopener noreferrer">Open Sent invitations</a></p>
    <label class="check"><input id="wd-remind" type="checkbox" checked=${remind} onChange=${e => setRemind(e.target.checked)} />Remind me to re-invite on ${fmtDay(addDays(TODAY, 21))}. LinkedIn blocks a new invite for about 3 weeks.</label>
  <//>`;
}
