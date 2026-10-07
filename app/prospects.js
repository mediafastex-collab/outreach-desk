/* Fastex Outreach Desk — prospects.js
   Prospect list, detail drawer, and the add / bulk-add / change-sequence dialogs. */
'use strict';

function haystack(p) {
  return [p.firstName, p.lastName, p.company, p.title, p.position, p.location, p.email, p.url, (p.tags || []).join(' '), p.notes].join(' ').toLowerCase();
}
function StepDots({ p, seq }) {
  if (!seq) return html`<span class="pill tone-overdue">No sequence</span>`;
  const cur = stepIndexOf(p, seq);
  const skipped = new Set((p.log || []).filter(e => e.kind === 'skipped').map(e => e.stepId));
  const open = ['queued', 'active', 'invited'].indexOf(p.status) !== -1;
  return html`<span class="dots" title=${stepTitle(seq, Math.min(cur, seq.steps.length - 1)) + ' · ' + Math.min(cur, seq.steps.length) + ' of ' + seq.steps.length + ' done'}>
    ${seq.steps.map((s, i) => html`<i key=${s.id} class=${i < cur ? (skipped.has(s.id) ? 'skip' : 'done') : (i === cur && open ? 'cur' : '')}></i>`)}
  </span>`;
}

function prospectsCSV(rows, data) {
  const head = ['Client', 'LinkedIn account', 'First name', 'Last name', 'Position', 'Headline', 'Company', 'Location', 'Email', 'LinkedIn URL', 'Status', 'Sequence', 'Current step', 'Next due', 'Added', 'Invited', 'Accepted', 'Replied', 'Tags', 'Notes'];
  const out = [head];
  for (const { p, next } of rows) {
    const c = data.clients[p.clientId];
    const s = senderOf(c, p);
    const seq = data.seqs[p.sequenceId];
    const i = seq ? stepIndexOf(p, seq) : -1;
    out.push([c ? c.name : '', s ? s.name : '', p.firstName, p.lastName, p.position || positionFromHeadline(p.title), p.title, p.company, p.location, p.email, p.url,
      (STATUSES[p.status] || {}).label || p.status, seq ? seq.name : '', seq && i < seq.steps.length ? stepTitle(seq, i) : '',
      next && next.due ? next.due : '', p.addedOn || '', p.invitedOn || '', p.acceptedOn || '', p.repliedOn || '', (p.tags || []).join(', '), p.notes || '']);
  }
  return toCSV(out);
}

function ProspectsView() {
  const data = currentData();
  const f = UI.prospectFilter;
  const setF = patch => { UI.set({ prospectFilter: Object.assign({}, f, patch) }); setLimit(100); };
  const [limit, setLimit] = useState(100);
  const [sel, setSel] = useState(() => new Set());
  const q = f.q.trim().toLowerCase();
  const client = f.clientId ? data.clients[f.clientId] : null;
  const scoped = useMemo(() => data.prospects.filter(p =>
    (!f.clientId || p.clientId === f.clientId) && (!f.senderId || p.senderId === f.senderId) &&
    (!f.sequenceId || p.sequenceId === f.sequenceId) && (!f.tag || (p.tags || []).indexOf(f.tag) !== -1) &&
    (!f.clientId || !f.listId || (f.listId === '_none' ? !p.listId : p.listId === f.listId)) &&
    (!q || haystack(p).indexOf(q) !== -1)), [data, f.clientId, f.senderId, f.sequenceId, f.tag, f.listId, q]);
  const lists = client ? listsOf(data, client.id) : [];
  const listCounts = useMemo(() => {
    const m = { _all: 0, _none: 0 };
    if (!client) return m;
    data.prospects.forEach(p => { if (p.clientId !== client.id) return; m._all++; if (p.listId && lists.some(l => l.id === p.listId)) m[p.listId] = (m[p.listId] || 0) + 1; else m._none++; });
    return m;
  }, [data, client && client.id]);
  const counts = useMemo(() => statusCounts(scoped), [scoped]);
  const rows = useMemo(() => {
    const list = !f.status ? scoped : f.status === 'open' ? scoped.filter(p => (STATUSES[p.status] || {}).open) : scoped.filter(p => p.status === f.status);
    const out = list.map(p => ({ p, next: nextAction(p, data, TODAY) }));
    const nm = x => fullName(x.p);
    if (f.sort === 'name') out.sort((a, b) => byText(nm(a), nm(b)));
    else if (f.sort === 'added') out.sort((a, b) => (b.p.createdAt || '').localeCompare(a.p.createdAt || ''));
    else if (f.sort === 'activity') out.sort((a, b) => (lastTs(b.p)).localeCompare(lastTs(a.p)));
    else out.sort((a, b) => {
      const da = a.next ? a.next.due : '9999', db = b.next ? b.next.due : '9999';
      return da < db ? -1 : da > db ? 1 : byText(nm(a), nm(b));
    });
    return out;
  }, [scoped, f.status, f.sort, data, TODAY]);
  const tags = useMemo(() => { const s = new Set(); data.prospects.forEach(p => (p.tags || []).forEach(t => s.add(t))); return Array.from(s).sort(byText); }, [data]);
  const keyOf = p => p.clientId + '/' + p.id;
  const visible = rows.slice(0, limit);
  const selected = rows.filter(r => sel.has(keyOf(r.p))).map(r => r.p);
  const allVisibleSel = visible.length > 0 && visible.every(r => sel.has(keyOf(r.p)));
  const toggle = p => { const n = new Set(sel); const k = keyOf(p); if (n.has(k)) n.delete(k); else n.add(k); setSel(n); };
  const toggleAll = () => { const n = new Set(sel); if (allVisibleSel) visible.forEach(r => n.delete(keyOf(r.p))); else visible.forEach(r => n.add(keyOf(r.p))); setSel(n); };
  const clearSel = () => setSel(new Set());
  const noClients = Object.keys(data.clients).length === 0;

  const bulkItems = [
    { header: 'Progress' },
    { label: 'Mark current step done', icon: 'check', onSelect: () => { Act.bulk(selected.filter(p => p.status === 'queued' || p.status === 'active'), p => actCompleteStep(p, seqFor(p), TODAY, me()), n => plural(n, 'step') + ' logged.'); clearSel(); } },
    { label: 'Mark accepted today', icon: 'userCheck', onSelect: () => { Act.bulk(selected.filter(p => p.status === 'invited'), p => actAccept(p, seqFor(p), TODAY, me()), n => plural(n, 'prospect') + ' marked accepted.'); clearSel(); } },
    { label: 'Resume sequence', icon: 'play', onSelect: () => { Act.bulk(selected.filter(p => ['paused', 'replied', 'interested', 'nurture'].indexOf(p.status) !== -1), p => actResume(p, seqFor(p), TODAY, me()), n => plural(n, 'prospect') + ' resumed.'); clearSel(); } },
    { label: 'Pause', icon: 'pause', onSelect: () => { Act.bulk(selected.filter(p => (STATUSES[p.status] || {}).open && p.status !== 'paused'), p => actSetStatus(p, seqFor(p), 'paused', TODAY, me(), {}), n => plural(n, 'prospect') + ' paused.'); clearSel(); } },
    { header: 'Outcome' },
    { label: 'Interested', onSelect: () => { Act.bulk(selected, p => actSetStatus(p, seqFor(p), 'interested', TODAY, me(), { followUpOn: addDays(TODAY, 2), followUpNote: 'Follow up on their interest' }), n => plural(n, 'prospect') + ' marked interested.'); clearSel(); } },
    { label: 'Meeting booked', onSelect: () => { Act.bulk(selected, p => actSetStatus(p, seqFor(p), 'meeting', TODAY, me(), {}), n => plural(n, 'meeting') + ' logged.'); clearSel(); } },
    { label: 'Not interested', onSelect: () => { Act.bulk(selected, p => actSetStatus(p, seqFor(p), 'not_interested', TODAY, me(), { followUpOn: null }), n => plural(n, 'prospect') + ' closed.'); clearSel(); } },
    { label: 'No reply (close)', onSelect: () => { Act.bulk(selected, p => actSetStatus(p, seqFor(p), 'finished', TODAY, me(), {}), n => plural(n, 'prospect') + ' closed.'); clearSel(); } },
    { divider: true },
    { label: 'Move to sequence…', icon: 'route', onSelect: () => UI.open('changeSeq', { ps: selected }) },
    { label: 'Add to a list…', icon: 'list', onSelect: () => UI.open('setList', { ps: selected }) },
    { label: 'Delete…', icon: 'trash', danger: true, onSelect: () => UI.open('confirm', {
      title: 'Delete ' + plural(selected.length, 'prospect') + '?', danger: true, confirmLabel: 'Delete',
      body: 'Their history is removed from reports too. You can undo right after.',
      onConfirm: async () => { await Act.bulkDelete(selected); clearSel(); } }) },
  ];
  const statusChips = [['', 'All', scoped.length], ['open', 'Open', scoped.filter(p => (STATUSES[p.status] || {}).open).length]].concat(STATUS_ORDER.filter(s => counts[s] > 0).map(s => [s, STATUSES[s].label, counts[s]]));

  return html`<div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">${client ? client.name : 'All clients'}</p>
        <h1>Prospects</h1>
        <p class="lede">${fmtNum(scoped.length)} ${q || f.clientId || f.senderId || f.sequenceId || f.tag ? 'matching' : 'in total'} · ${fmtNum(counts.active + counts.invited + counts.queued)} in progress · ${fmtNum(counts.meeting)} meetings booked</p>
      </div>
      <div class="head-actions">
        <${HelpButton} view="prospects" />
        <button type="button" class="btn" disabled=${!rows.length} onClick=${() => saveFile('prospects-' + TODAY + '.csv', prospectsCSV(rows, data))}><${Icon} n="download" s=${14} />Export CSV</button>
        <button type="button" class="btn" disabled=${noClients} onClick=${() => UI.open('bulk', { clientId: f.clientId })}><${Icon} n="upload" s=${14} />Add in bulk</button>
        <button type="button" class="btn primary" disabled=${noClients} onClick=${() => UI.open('addProspect', { clientId: f.clientId })}><${Icon} n="plus" s=${14} />Add prospect</button>
      </div>
    </header>

    <div class="toolbar">
      <label class="search grow"><${Icon} n="search" s=${15} /><span class="sr">Search prospects</span>
        <input id="p-search" class="input" type="search" placeholder="Search name, company, headline, tag…" value=${f.q} onInput=${e => setF({ q: e.target.value })} /></label>
      <${ClientSelect} id="p-client" cls="select sm" data=${data} value=${f.clientId} all=${true} includeInactive=${true} onChange=${v => setF({ clientId: v, senderId: '', listId: '' })} />
      ${client && (client.senders || []).length > 1 && html`<select id="p-sender" class="select sm" value=${f.senderId} onChange=${e => setF({ senderId: e.target.value })}>
        <option value="" selected=${!f.senderId}>All accounts</option>
        ${client.senders.map(s => html`<option key=${s.id} value=${s.id} selected=${f.senderId === s.id}>${s.name}</option>`)}
      </select>`}
      <${SequenceSelect} id="p-seq" cls="select sm" data=${data} value=${f.sequenceId} allowEmpty="All sequences" onChange=${v => setF({ sequenceId: v })} />
      ${tags.length > 0 && html`<select id="p-tag" class="select sm" value=${f.tag} onChange=${e => setF({ tag: e.target.value })}>
        <option value="" selected=${!f.tag}>All tags</option>${tags.map(t => html`<option key=${t} value=${t} selected=${f.tag === t}>${t}</option>`)}</select>`}
      <select id="p-sort" class="select sm" value=${f.sort} onChange=${e => setF({ sort: e.target.value })} aria-label="Sort">
        <option value="next" selected=${f.sort === 'next'}>Sort: next due</option>
        <option value="added" selected=${f.sort === 'added'}>Sort: newest</option>
        <option value="activity" selected=${f.sort === 'activity'}>Sort: recent activity</option>
        <option value="name" selected=${f.sort === 'name'}>Sort: name</option>
      </select>
    </div>

    ${client ? html`<div class="list-strip" role="group" aria-label="Lists">
      <span class="label"><${Icon} n="list" s=${14} />Lists</span>
      <button type="button" aria-pressed=${!f.listId ? 'true' : 'false'} onClick=${() => setF({ listId: '' })}>All<span class="n">${listCounts._all}</span></button>
      ${lists.map(l => html`<button type="button" key=${l.id} aria-pressed=${f.listId === l.id ? 'true' : 'false'} onClick=${() => setF({ listId: l.id })}>${l.name}<span class="n">${listCounts[l.id] || 0}</span></button>`)}
      ${lists.length > 0 && html`<button type="button" aria-pressed=${f.listId === '_none' ? 'true' : 'false'} onClick=${() => setF({ listId: '_none' })}>Not in a list<span class="n">${listCounts._none}</span></button>`}
      <button type="button" class="ghostchip" onClick=${() => UI.open('lists', { clientId: client.id })}><${Icon} n="plus" s=${13} />${lists.length ? 'Manage lists' : 'Create a list'}</button>
    </div>` : Object.values(data.clients).some(c => (c.lists || []).length) && html`<p class="muted" style="font-size:12.5px">Pick a client to see and filter by its lists.</p>`}

    <div class="status-strip" role="group" aria-label="Status">
      ${statusChips.map(([k, l, n]) => html`<button type="button" key=${k || 'all'} aria-pressed=${f.status === k ? 'true' : 'false'} onClick=${() => setF({ status: k })}>
        ${k && STATUSES[k] && html`<span class=${'dot tone-' + STATUSES[k].tone} style="background:currentColor"></span>`}${l}<span class="n">${n}</span></button>`)}
    </div>

    ${selected.length > 0 && html`<div class="bulkbar">
      <strong>${selected.length} selected</strong>
      <${Menu} label="Actions" btnClass="btn sm" items=${bulkItems} />
      <button type="button" class="btn sm" onClick=${clearSel}>Clear</button>
    </div>`}

    <div class="panel plist">
      ${rows.length === 0 ? html`<${Empty} icon="users" title=${data.prospects.length ? 'No prospects match' : 'No prospects yet'}
          action=${!noClients && html`<div class="btn-row" style="justify-content:center">
            <button type="button" class="btn" onClick=${() => UI.open('bulk', { clientId: f.clientId })}><${Icon} n="upload" s=${14} />Paste URLs or import CSV</button>
            <button type="button" class="btn primary" onClick=${() => UI.open('addProspect', { clientId: f.clientId })}><${Icon} n="plus" s=${14} />Add prospect</button></div>`}>
          ${noClients ? 'Add a client first, then add their prospects.' : data.prospects.length ? 'Try clearing a filter or the search.' : 'Paste a list of LinkedIn URLs or import a CSV from Sales Navigator.'}</${Empty}>` : html`
        <div class="prow head" role="row">
          <input type="checkbox" aria-label="Select all shown" checked=${allVisibleSel} onChange=${toggleAll} />
          <span>Prospect</span><span>Client · account</span><span>Status</span><span>Progress</span><span>Next</span><span>Last activity</span><span></span>
        </div>
        ${visible.map(({ p, next }) => {
          const c = data.clients[p.clientId];
          const s = senderOf(c, p);
          const isSel = sel.has(keyOf(p));
          return html`<div class=${'prow' + (isSel ? ' sel' : '')} key=${keyOf(p)} role="row">
            <input type="checkbox" aria-label=${'Select ' + fullName(p)} checked=${isSel} onChange=${() => toggle(p)} />
            <div class="who"><button type="button" onClick=${() => UI.openProspect(p)}>${fullName(p)}</button>
              <div class="sub">${roleLine(p) || p.url}</div></div>
            <div class="cl"><${ClientChip} client=${c} /><span class="sub">${s ? s.name : 'No account'}${p.listId && listName(data, p.clientId, p.listId) ? ' · ' + listName(data, p.clientId, p.listId) : ''}</span></div>
            <div><${StatusPill} status=${p.status} /></div>
            <div><${StepDots} p=${p} seq=${data.seqs[p.sequenceId]} /></div>
            <div class="nx">${next ? html`<div class="t">${next.text}</div>${next.sub && html`<span class=${'pill tone-' + next.tone}>${next.sub}</span>`}` : html`<span class="muted">–</span>`}</div>
            <${LastActivity} p=${p} />
            <a class="btn sm ghost icon" href=${p.url} target="_blank" rel="noopener noreferrer" aria-label=${'Open ' + fullName(p) + ' on LinkedIn'}><${Icon} n="external" s=${14} /></a>
          </div>`;
        })}
        ${rows.length > limit && html`<div class="panel-pad"><button type="button" class="btn" onClick=${() => setLimit(limit + 200)}>Show ${Math.min(200, rows.length - limit)} more of ${fmtNum(rows.length - limit)}</button></div>`}
      `}
    </div>
  </div>`;
}

/* ---------- detail drawer ---------- */
function lastEntry(p) { const l = p.log || []; return l.length ? l[l.length - 1] : null; }
function lastTs(p) { const e = lastEntry(p); return (e && e.ts) || p.updatedAt || ''; }
function whenText(e) { return fmtDay(e.on) + (e.ts ? ' · ' + fmtTime(e.ts) : ''); }
function LastActivity({ p }) {
  const e = lastEntry(p);
  if (!e) return html`<div class="la muted">–</div>`;
  const k = ACTIVITY_KINDS[activityKind(e)];
  return html`<div class="la" title=${activityText(e)}>
    <span class=${'la-type tone-' + k.tone}><${Icon} n=${k.icon} s=${12} />${k.label}</span>
    <span class="la-when mono">${relDay(e.on, TODAY)}${e.ts ? ' · ' + fmtTime(e.ts) : ''}</span>
  </div>`;
}
function ActivityRow({ e, data, prospect, showWho }) {
  const k = ACTIVITY_KINDS[activityKind(e)];
  const who = e.by ? memberName(data.settings, e.by) : '';
  const note = activityNote(e);
  return html`<li class="act">
    <span class=${'act-ic tone-' + k.tone}><${Icon} n=${k.icon} s=${13} /></span>
    <div class="act-body">
      <div class="act-top"><span class="act-type">${k.label}</span><span class="act-when mono">${whenText(e)}</span></div>
      <div class="act-text">${showWho && prospect ? html`<button type="button" class="linkish" onClick=${() => UI.openProspect(prospect)}>${fullName(prospect)}</button> · ` : ''}${activityText(e)}${who ? html` <span class="muted">· by ${who}</span>` : ''}</div>
      ${note && html`<div class="act-note">${note}</div>`}
    </div>
  </li>`;
}

function NextCard({ p, data }) {
  const seq = data.seqs[p.sequenceId];
  const client = data.clients[p.clientId];
  const sender = senderOf(client, p);
  const [busy, setBusy] = useState(false);
  const run = fn => async () => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const replied = html`<button type="button" class="btn sm" onClick=${() => UI.open('reply', { p })}><${Icon} n="reply" s=${14} />They replied…</button>`;
  if ((p.status === 'queued' || p.status === 'active') && seq) {
    const i = stepIndexOf(p, seq);
    const step = seq.steps[i];
    if (!step) return null;
    const due = stepDue(p, seq, i, data.settings);
    const filled = fillTemplate(step.template, p, client, sender);
    const text = filled.text.trim();
    const di = dueInfo(due, TODAY);
    return html`<div class="next-card">
      <div class="task-meta"><span class="what">${stepTitle(seq, i)}</span><span class=${'pill tone-' + di.tone}>${di.text}</span></div>
      ${text && html`<div class="task-msg" style="cursor:default"><${MsgText} text=${text} /></div>`}
      ${step.type === 'connect' && text && html`<${Chars} text=${text} connect=${true} />`}
      ${!text && html`<p class="task-note">${(STEP_TYPES[step.type] || STEP_TYPES.task).verb}.</p>`}
      <div class="btn-row">
        <a class="btn sm" href=${p.url} target="_blank" rel="noopener noreferrer" onClick=${text ? () => copyText(text, 'Message copied') : undefined}><${Icon} n=${text ? 'copy' : 'external'} s=${14} />${text ? 'Copy & open' : 'Open profile'}</a>
        <button type="button" class="btn sm primary" disabled=${busy} onClick=${run(() => Act.done(p))}><${Icon} n="check" s=${14} />${step.type === 'connect' ? 'Invite sent' : groupOf(step.type) === 'message' ? 'Sent' : 'Done'}</button>
        <${Menu} icon="more" items=${taskMenuItems({ kind: 'step', p })} />
      </div>
    </div>`;
  }
  if (p.status === 'invited') {
    const days = p.invitedOn ? daysBetween(p.invitedOn, TODAY) : 0;
    const stale = days >= (data.settings.staleDays || 21);
    return html`<div class="next-card">
      <div class="task-meta"><span class="what">Waiting for acceptance</span><span class=${'pill ' + (stale ? 'tone-overdue' : 'tone-info')}>sent ${relDay(p.invitedOn, TODAY)}</span></div>
      ${stale && html`<p class="task-note">Pending ${days} days. Consider withdrawing it to keep the account's pending list short.</p>`}
      <div class="btn-row">
        <button type="button" class="btn sm primary" disabled=${busy} onClick=${run(() => acceptAndGuide(p, TODAY))}><${Icon} n="userCheck" s=${14} />Accepted today</button>
        <button type="button" class="btn sm" onClick=${() => openAcceptOnDate(p)}>Accepted earlier…</button>
        ${replied}
        <button type="button" class="btn sm" onClick=${() => openWithdraw(p)}><${Icon} n="logout" s=${14} />Withdraw…</button>
      </div>
    </div>`;
  }
  if (p.status === 'replied') {
    const last = (p.log || []).slice().reverse().find(e => e.kind === 'replied');
    return html`<div class="next-card">
      <div class="task-meta"><span class="what">Reply waiting</span><span class="pill tone-reply">${relDay(p.repliedOn, TODAY)}</span></div>
      <p class="task-note">Replied after ${(p.replyAfter || 'the sequence').toLowerCase()}. The sequence is stopped.${last && last.note ? ' “' + last.note + '”' : ''}</p>
      <div class="btn-row">
        <button type="button" class="btn sm primary" onClick=${() => UI.open('reply', { p, mode: 'outcome' })}><${Icon} n="flag" s=${14} />Log outcome</button>
        <button type="button" class="btn sm" disabled=${busy} onClick=${run(() => Act.resume(p))}><${Icon} n="play" s=${14} />Resume (auto-reply)</button>
      </div>
    </div>`;
  }
  if (p.status === 'paused') {
    return html`<div class="next-card"><div class="task-meta"><span class="what">Paused</span></div>
      <div class="btn-row"><button type="button" class="btn sm primary" disabled=${busy} onClick=${run(() => Act.resume(p))}><${Icon} n="play" s=${14} />Resume sequence</button>${replied}</div></div>`;
  }
  if (p.status === 'interested' || p.status === 'nurture' || p.status === 'meeting') {
    return html`<div class="next-card">
      <div class="task-meta"><${StatusPill} status=${p.status} />${p.status === 'meeting' && p.meetingOn && html`<span class="pill tone-good">${fmtDay(p.meetingOn)}</span>`}</div>
      <div class="btn-row">
        ${p.status !== 'meeting' && html`<button type="button" class="btn sm primary" onClick=${() => UI.open('reply', { p, mode: 'outcome' })}><${Icon} n="flag" s=${14} />Update outcome</button>`}
        ${p.status === 'meeting' && html`<button type="button" class="btn sm" onClick=${() => UI.open('reply', { p, mode: 'outcome' })}>Change outcome</button>`}
        ${p.status !== 'meeting' && html`<button type="button" class="btn sm" disabled=${busy} onClick=${run(() => Act.resume(p))}><${Icon} n="play" s=${14} />Resume sequence</button>`}
      </div>
    </div>`;
  }
  return html`<div class="next-card">
    <div class="task-meta"><${StatusPill} status=${p.status} />${p.closedOn && html`<span class="muted">since ${fmtDay(p.closedOn)}</span>`}</div>
    <div class="btn-row">
      ${p.status !== 'not_interested' && replied}
      <button type="button" class="btn sm" disabled=${busy || !seq} onClick=${run(() => Act.restart(p, false))}><${Icon} n="undo" s=${14} />Restart sequence</button>
      ${(p.acceptedOn || p.alreadyConnected) && html`<button type="button" class="btn sm" disabled=${busy || !seq} onClick=${run(() => Act.restart(p, true))}>Restart from first message</button>`}
    </div>
  </div>`;
}

function Timeline({ p, seq, data }) {
  const [openIdx, setOpenIdx] = useState(-1);
  if (!seq) return html`<p class="muted">No sequence assigned.</p>`;
  const client = data.clients[p.clientId];
  const sender = senderOf(client, p);
  const tl = projectTimeline(p, seq, data.settings, TODAY);
  return html`<ol class="tl">
    ${tl.map(x => {
      const filled = fillTemplate(x.step.template, p, client, sender).text.trim();
      let when = '', sub = '';
      if (x.state === 'done') { when = x.on ? fmtShort(x.on) : ''; sub = groupOf(x.step.type) === 'touch' ? 'Done' : 'Sent'; }
      else if (x.state === 'skipped') { when = x.on ? fmtShort(x.on) : ''; sub = 'Skipped'; }
      else if (x.state === 'current') { when = fmtDay(x.due); sub = dueInfo(x.due, TODAY).text; }
      else if (x.state === 'waiting') { when = x.rel ? '+' + x.rel + 'd' : 'on accept'; sub = x.rel ? x.rel + ' days after they accept' : 'Due when they accept'; }
      else if (x.state === 'future') {
        if (x.due) { when = '≈ ' + fmtShort(x.due); sub = 'Projected'; }
        else { when = x.rel ? '+' + x.rel + 'd' : 'on accept'; sub = x.rel ? x.rel + ' days after they accept' : 'When they accept'; }
      } else { sub = 'Not sent'; }
      const cls = x.state === 'stopped' ? 'future' : x.state;
      return html`<li key=${x.step.id} class=${cls} style=${x.state === 'stopped' ? 'opacity:.55' : ''}>
        <span class="node">${(x.state === 'done') && html`<${Icon} n="check" s=${12} />`}${x.state === 'skipped' && html`<${Icon} n="skip" s=${10} />`}</span>
        <div>
          <div class="t1">${stepTitle(seq, x.i)}</div>
          <div class="t2">${sub}${filled && html` · <button type="button" class="btn ghost sm" style="height:22px;padding:0 6px" onClick=${() => setOpenIdx(openIdx === x.i ? -1 : x.i)}>${openIdx === x.i ? 'Hide' : 'Show'} message</button>`}</div>
          ${openIdx === x.i && filled && html`<div class="task-msg msg" style="cursor:default"><${MsgText} text=${filled} />
            <div class="btn-row" style="margin-top:8px"><button type="button" class="btn sm" onClick=${() => copyText(filled, 'Message copied')}><${Icon} n="copy" s=${14} />Copy</button></div></div>`}
        </div>
        <span class="when">${when}</span>
      </li>`;
    })}
  </ol>`;
}

function DetailsForm({ p, data }) {
  const init = () => ({ firstName: p.firstName || '', lastName: p.lastName || '', title: p.title || '', position: p.position || '', company: p.company || '', location: p.location || '', email: p.email || '', url: p.url || '', tags: (p.tags || []).join(', '), notes: p.notes || '', clientId: p.clientId, senderId: p.senderId || '' });
  const [v, setV] = useState(init);
  const [err, setErr] = useState('');
  useEffect(() => { setV(init()); setErr(''); }, [p.id, p.clientId]);
  const set = k => e => setV(Object.assign({}, v, { [k]: e.target.value }));
  const client = data.clients[v.clientId];
  const dirty = JSON.stringify(v) !== JSON.stringify(init());
  const save = async e => {
    e.preventDefault();
    setErr('');
    const norm = normalizeLinkedIn(v.url);
    if (!norm) { setErr(checkLinkedIn(v.url).error); return; }
    if (!v.firstName.trim()) { setErr('First name is required.'); return; }
    const patch = { firstName: v.firstName.trim(), lastName: v.lastName.trim(), title: v.title.trim(), position: v.position.trim(), company: v.company.trim(), location: v.location.trim(), email: v.email.trim(), tags: v.tags.split(',').map(t => t.trim()).filter(Boolean), notes: v.notes.trim() };
    if (norm.key !== p.urlKey) {
      const newId = prospectDocId(norm.key);
      if (findProspect(p.clientId, newId)) { setErr('Another prospect in this client already has that URL.'); return; }
      const next = Object.assign(clone(p), patch, { id: newId, url: norm.url, urlKey: norm.key, urlKind: norm.kind, updatedAt: nowTs() });
      if (!W.guard()) return;
      if (await W.saveProspect(next)) { await W.deleteProspect(p); UI.drawer = { cid: p.clientId, pid: newId }; UI.toast('Saved.'); }
      return;
    }
    if (v.clientId !== p.clientId) { await Act.move(Object.assign(clone(fresh(p)), patch), v.clientId, v.senderId || null); return; }
    await Act.update(fresh(p), Object.assign(patch, { senderId: v.senderId || null }), 'Saved.');
  };
  const applyPaste = d => setV(Object.assign({}, v, { firstName: v.firstName || d.firstName || '', lastName: v.lastName || d.lastName || '', title: d.title || v.title, position: d.position || v.position, company: d.company || v.company, location: d.location || v.location }));
  return html`<form class="stack" onSubmit=${save}>
    <${ProfilePaste} compact=${true} onApply=${applyPaste} />
    <div class="fields">
      <label class="field"><span>First name</span><input id="d-first" class="input" value=${v.firstName} onInput=${set('firstName')} /></label>
      <label class="field"><span>Last name</span><input id="d-last" class="input" value=${v.lastName} onInput=${set('lastName')} /></label>
      <label class="field"><span>Position</span><input id="d-pos" class="input" placeholder="e.g. Head of Growth" value=${v.position} onInput=${set('position')} /></label>
      <label class="field"><span>Headline</span><input id="d-title" class="input" value=${v.title} onInput=${set('title')} /></label>
      <label class="field"><span>Company</span><input id="d-company" class="input" value=${v.company} onInput=${set('company')} /></label>
      <label class="field"><span>Location</span><input id="d-location" class="input" value=${v.location} onInput=${set('location')} /></label>
      <label class="field full"><span>LinkedIn URL</span><input id="d-url" class="input" value=${v.url} onInput=${set('url')} /></label>
      <label class="field"><span>Email</span><input id="d-email" class="input" type="email" value=${v.email} onInput=${set('email')} /></label>
      <label class="field"><span>Tags <span class="hint">comma separated</span></span><input id="d-tags" class="input" value=${v.tags} onInput=${set('tags')} /></label>
      <label class="field"><span>Client</span><${ClientSelect} id="d-client" data=${data} value=${v.clientId} onChange=${x => { const c = data.clients[x]; setV(Object.assign({}, v, { clientId: x, senderId: c && c.senders && c.senders[0] ? c.senders[0].id : '' })); }} /></label>
      <label class="field"><span>LinkedIn account</span><select id="d-sender" class="select" value=${v.senderId} onChange=${set('senderId')}>
        <option value="" selected=${!v.senderId}>Not set</option>
        ${((client && client.senders) || []).map(s => html`<option key=${s.id} value=${s.id} selected=${v.senderId === s.id}>${s.name}</option>`)}
      </select></label>
      <label class="field full"><span>Notes</span><textarea id="d-notes" class="textarea" style="min-height:70px" value=${v.notes} onInput=${set('notes')}></textarea></label>
    </div>
    ${err && html`<p class="err" style="color:var(--overdue);font-size:13px">${err}</p>`}
    <div class="btn-row"><button type="submit" class="btn primary" disabled=${!dirty}>Save changes</button>${dirty && html`<button type="button" class="btn ghost" onClick=${() => setV(init())}>Discard</button>`}</div>
  </form>`;
}

function ProspectDrawer({ cid, pid }) {
  const data = currentData();
  const p = findProspect(cid, pid);
  const [noteText, setNoteText] = useState('');
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !UI.modal) UI.closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!p) {
    return html`<div><div class="scrim" onClick=${() => UI.closeDrawer()}></div>
      <aside class="drawer" aria-label="Prospect"><div class="drawer-head"><h2>Prospect not found</h2><p class="soft">It may have been deleted or moved.</p>
        <div class="btn-row"><button type="button" class="btn" onClick=${() => UI.closeDrawer()}>Close</button></div></div></aside></div>`;
  }
  const client = data.clients[p.clientId];
  const sender = senderOf(client, p);
  const seq = data.seqs[p.sequenceId];
  const op = memberName(data.settings, operatorOf(client, sender));
  const others = data.prospects.filter(x => x.urlKey === p.urlKey && x.clientId !== p.clientId);
  const log = (p.log || []).slice().reverse();
  const addNote = e => { e.preventDefault(); const t = noteText.trim(); if (!t) return; Act.note(p, t); setNoteText(''); };
  return html`<div>
    <div class="scrim" onClick=${() => UI.closeDrawer()}></div>
    <aside class="drawer" aria-label=${'Prospect ' + fullName(p)}>
      <div class="drawer-head">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0">
            <h2>${fullName(p)}</h2>
            <p class="soft">${roleLine(p) || 'No position or company yet'}${p.location ? ' · ' + p.location : ''}</p>
            ${p.title && p.title !== roleLine(p) && html`<p class="muted" style="font-size:12.5px;margin-top:2px">${p.title}</p>`}
          </div>
          <button type="button" class="btn ghost icon" aria-label="Close" onClick=${() => UI.closeDrawer()}><${Icon} n="x" /></button>
        </div>
        <div class="task-meta">
          <${StatusPill} status=${p.status} />
          <${ClientChip} client=${client} />
          <span class="muted" style="font-size:12.5px">${sender ? sender.name : 'No account'}${op ? ' · ' + op : ''}</span>
          ${p.listId && listName(data, p.clientId, p.listId) && html`<span class="pill tone-neutral"><${Icon} n="list" s=${12} />${listName(data, p.clientId, p.listId)}</span>`}
          ${p.urlKind === 'salesnav' && html`<span class="pill tone-today">Sales Navigator link</span>`}
        </div>
        <div class="btn-row">
          <a class="btn sm" href=${p.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external" s=${14} />Open on LinkedIn</a>
          <button type="button" class="btn sm" onClick=${() => openReminder(p)}><${Icon} n="bell" s=${14} />${p.followUpOn ? 'Change reminder' : 'Set reminder'}</button>
          <${Menu} icon="more" items=${[
            { label: 'Move to another sequence…', icon: 'route', onSelect: () => UI.open('changeSeq', { ps: [p] }) },
            { label: p.listId ? 'Change list…' : 'Add to a list…', icon: 'list', onSelect: () => UI.open('setList', { ps: [p] }) },
            (STATUSES[p.status] || {}).open && p.status !== 'paused' ? { label: 'Pause', icon: 'pause', onSelect: () => Act.pause(p) } : null,
            p.status === 'paused' ? { label: 'Resume', icon: 'play', onSelect: () => Act.resume(p) } : null,
            { divider: true },
            { label: 'Delete prospect…', icon: 'trash', danger: true, onSelect: () => UI.open('confirm', { title: 'Delete ' + fullName(p) + '?', danger: true, confirmLabel: 'Delete', body: 'Their activity history goes too. You can undo right after.', onConfirm: () => Act.remove(p) }) },
          ]} />
        </div>
      </div>
      <div class="drawer-body">
        ${others.length > 0 && html`<div class="note-box warn">Also a prospect for ${others.map(o => (data.clients[o.clientId] || {}).name).join(', ')}. Coordinate so they don't hear from two accounts.</div>`}
        <section class="drawer-sec"><h3>Journey</h3><${Journey} p=${p} seq=${seq} /></section>
        <section class="drawer-sec"><h3>Next</h3><${NextCard} p=${p} data=${data} /></section>
        ${p.followUpOn && html`<section class="drawer-sec"><h3>Reminder</h3>
          <div class="next-card"><div class="task-meta"><${Due} due=${p.followUpOn} /><span>${p.followUpNote || 'Follow up'}</span></div>
            <div class="btn-row"><button type="button" class="btn sm primary" onClick=${() => Act.reminderDone(p)}><${Icon} n="check" s=${14} />Done</button>
              <button type="button" class="btn sm" onClick=${() => openReminder(p)}>Change</button></div></div></section>`}
        <section class="drawer-sec"><h3>${seq ? seq.name : 'Sequence'}</h3><${Timeline} p=${p} seq=${seq} data=${data} /></section>
        <section class="drawer-sec"><h3>Details</h3><${DetailsForm} p=${p} data=${data} /></section>
        <section class="drawer-sec"><h3>Activity</h3>
          <form class="team-row" onSubmit=${addNote}><input id="d-note" class="input" placeholder="Add a note" value=${noteText} onInput=${e => setNoteText(e.target.value)} /><button type="submit" class="btn" disabled=${!noteText.trim()}>Add</button></form>
          <ul class="acts">
            ${log.map((e, i) => html`<${ActivityRow} key=${i} e=${e} data=${data} />`)}
          </ul>
        </section>
      </div>
    </aside>
  </div>`;
}

/* ---------- add one prospect ---------- */
function defaultClientId(data, preferred) {
  if (preferred && data.clients[preferred]) return preferred;
  const list = Object.values(data.clients).filter(c => c.status !== 'archived').sort((a, b) => byText(a.name, b.name));
  return list[0] ? list[0].id : '';
}
function AddProspectModal({ clientId }) {
  const data = currentData();
  const blank = cid => {
    const c = data.clients[cid];
    return { position: '', listId: '', newList: '', clientId: cid, senderId: c && c.senders && c.senders[0] ? c.senders[0].id : '', sequenceId: (c && c.defaultSequenceId && data.seqs[c.defaultSequenceId]) ? c.defaultSequenceId : (Object.values(data.seqs).find(s => !s.archived) || {}).id || '', url: '', firstName: '', lastName: '', title: '', company: '', location: '', email: '', tags: '', notes: '', startOn: TODAY, alreadyConnected: false };
  };
  const [v, setV] = useState(() => blank(defaultClientId(data, clientId)));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const client = data.clients[v.clientId];
  const norm = normalizeLinkedIn(v.url);
  const dup = norm ? findProspect(v.clientId, prospectDocId(norm.key)) : null;
  const elsewhere = norm ? data.prospects.filter(x => x.urlKey === norm.key && x.clientId !== v.clientId) : [];
  const set = k => e => setV(Object.assign({}, v, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const onUrlBlur = () => {
    const n = normalizeLinkedIn(v.url);
    if (!n) return;
    const nm = nameFromSlug(n.slug);
    setV(Object.assign({}, v, { url: n.url, firstName: v.firstName || nm.firstName, lastName: v.lastName || nm.lastName }));
  };
  const submit = async (e, again) => {
    if (e) e.preventDefault();
    setErr('');
    if (!v.clientId) { setErr('Choose a client.'); return; }
    if (!norm) { setErr(checkLinkedIn(v.url).error); return; }
    if (dup) { setErr(fullName(dup) + ' is already a prospect for this client.'); return; }
    const nm = nameFromSlug(norm.slug);
    const first = v.firstName.trim() || nm.firstName;
    if (!first) { setErr('Add a first name. Messages use it.'); return; }
    const seq = data.seqs[v.sequenceId] || null;
    if (!seq) { setErr('Choose a sequence.'); return; }
    if (!W.guard()) return;
    if (v.listId === '__new' && !v.newList.trim()) { setErr('Name the new list, or pick an existing one.'); return; }
    setBusy(true);
    let listId = v.listId;
    if (listId === '__new') { const l = await createList(v.clientId, v.newList); listId = l ? l.id : ''; }
    const p = newProspect(Object.assign({}, v, { listId, firstName: first, lastName: v.lastName.trim() || (v.firstName.trim() ? '' : nm.lastName), norm }), { seq, today: TODAY, by: me(), source: 'Added by hand' });
    const ok = await W.saveProspect(p);
    setBusy(false);
    if (!ok) return;
    UI.toast(fullName(p) + ' added. ' + (v.alreadyConnected ? 'First message is on the list.' : 'Connection request is on the list.'), { undo: () => W.deleteProspect(p) });
    if (again) setV(Object.assign(blank(v.clientId), { position: '', senderId: v.senderId, sequenceId: v.sequenceId, tags: v.tags, startOn: v.startOn, listId }));
    else UI.close();
  };
  if (!Object.keys(data.clients).length) {
    return html`<${Modal} title="Add a prospect" size="narrow" foot=${html`<button type="button" class="btn primary" onClick=${() => UI.open('client', {})}>Add a client first</button>`}>
      <p class="soft">Prospects belong to a client and a LinkedIn account. Add a client to get started.</p><//>`;
  }
  return html`<${Modal} title="Add a prospect" sub="They start at the first step of the sequence on the start date."
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>
      <button type="button" class="btn" disabled=${busy} onClick=${() => submit(null, true)}>Add and add another</button>
      <button type="submit" form="add-form" class="btn primary" disabled=${busy}>Add prospect</button>`}>
    <form id="add-form" class="stack" onSubmit=${e => submit(e, false)}>
      <${ProfilePaste} onApply=${d => setV(Object.assign({}, v, { url: d.url || v.url, firstName: d.firstName || v.firstName, lastName: d.lastName || v.lastName, title: d.title || v.title, position: d.position || v.position, company: d.company || v.company, location: d.location || v.location }))} />
      <label class="field"><span>LinkedIn URL</span>
        <input id="a-url" class="input" data-autofocus placeholder="https://www.linkedin.com/in/jane-doe" value=${v.url} onInput=${set('url')} onBlur=${onUrlBlur} />
        ${v.url && !norm && html`<span class="err">${checkLinkedIn(v.url).error}</span>`}
        ${dup && html`<span class="err">Already a prospect for this client (${(STATUSES[dup.status] || {}).label}).</span>`}
        ${elsewhere.length > 0 && html`<span class="hint">Also a prospect for ${elsewhere.map(o => (data.clients[o.clientId] || {}).name).join(', ')}.</span>`}
        ${norm && norm.kind === 'salesnav' && html`<span class="hint">Sales Navigator link: it opens in Sales Navigator for whoever has a seat.</span>`}
      </label>
      <div class="fields">
        <label class="field"><span>First name</span><input id="a-first" class="input" value=${v.firstName} onInput=${set('firstName')} /></label>
        <label class="field"><span>Last name</span><input id="a-last" class="input" value=${v.lastName} onInput=${set('lastName')} /></label>
        <label class="field"><span>Position</span><input id="a-pos" class="input" placeholder="e.g. Head of Growth" value=${v.position} onInput=${set('position')} /></label>
        <label class="field"><span>Headline</span><input id="a-title" class="input" placeholder="Their LinkedIn headline" value=${v.title} onInput=${set('title')} /></label>
        <label class="field"><span>Company</span><input id="a-company" class="input" value=${v.company} onInput=${set('company')} /></label>
        <label class="field"><span>Location</span><input id="a-location" class="input" value=${v.location} onInput=${set('location')} /></label>
        <label class="field"><span>Client</span><${ClientSelect} id="a-client" data=${data} value=${v.clientId} onChange=${x => setV(Object.assign(blank(x), { url: v.url, firstName: v.firstName, lastName: v.lastName, title: v.title, company: v.company, location: v.location, email: v.email, tags: v.tags, notes: v.notes }))} /></label>
        <label class="field"><span>LinkedIn account</span><select id="a-sender" class="select" value=${v.senderId} onChange=${set('senderId')}>
          ${((client && client.senders) || []).map(s => html`<option key=${s.id} value=${s.id} selected=${v.senderId === s.id}>${s.name}</option>`)}
          ${!((client && client.senders) || []).length && html`<option value="">No accounts on this client</option>`}
        </select></label>
        <label class="field"><span>Sequence</span><${SequenceSelect} id="a-seq" data=${data} clientId=${v.clientId} value=${v.sequenceId} onChange=${x => setV(Object.assign({}, v, { sequenceId: x }))} /></label>
        <label class="field"><span>Start date</span><input id="a-start" type="date" class="input" value=${v.startOn} onInput=${set('startOn')} /></label>
        <label class="field"><span>Email <span class="hint">optional</span></span><input id="a-email" class="input" type="email" value=${v.email} onInput=${set('email')} /></label>
        <label class="field"><span>List</span><${ListSelect} id="a-list" data=${data} clientId=${v.clientId} value=${v.listId} allowNew=${true} onChange=${x => { const l = listsOf(data, v.clientId).find(y => y.id === x); setV(Object.assign({}, v, { listId: x, sequenceId: l && l.sequenceId && data.seqs[l.sequenceId] ? l.sequenceId : v.sequenceId })); }} />
          ${v.listId === '__new' && html`<input id="a-newlist" class="input" style="margin-top:6px" placeholder="New list name, e.g. SaaS founders Q4" value=${v.newList} onInput=${set('newList')} />`}</label>
        <label class="field"><span>Tags <span class="hint">comma separated</span></span><input id="a-tags" class="input" placeholder="q4-founders, webinar" value=${v.tags} onInput=${set('tags')} /></label>
        <label class="field full"><span>Notes</span><textarea id="a-notes" class="textarea" style="min-height:60px" placeholder="Personalization hook, mutual connection, recent post…" value=${v.notes} onInput=${set('notes')}></textarea></label>
      </div>
      <label class="check"><input id="a-connected" type="checkbox" checked=${v.alreadyConnected} onChange=${set('alreadyConnected')} />Already connected on LinkedIn. Skip the connection request and start with the first message.</label>
      ${err && html`<div class="note-box bad">${err}</div>`}
    </form>
  <//>`;
}

/* ---------- add many: paste URLs or import CSV ---------- */
function parsePastedLines(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    if (raw.indexOf('FOD1:') !== -1) {
      const d = parseProfileText(raw);
      if (d.url) out.push({ line: i + 1, raw, row: { url: d.url, firstName: d.firstName, lastName: d.lastName, title: d.title, position: d.position, company: d.company, location: d.location } });
      else out.push({ line: i + 1, raw: raw.slice(0, 60), error: 'That copied profile has no LinkedIn URL in it.' });
      return;
    }
    const cells = (raw.indexOf('\t') !== -1 ? raw.split('\t') : raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).map(c => c.trim().replace(/^"|"$/g, ''));
    const ui = cells.findIndex(c => normalizeLinkedIn(c));
    if (ui === -1) {
      const guess = cells.find(c => /linkedin|lnkd|https?:|www\./i.test(c)) || cells[0];
      out.push({ line: i + 1, raw, error: checkLinkedIn(guess).error });
      return;
    }
    const rest = cells.filter((c, j) => j !== ui && c);
    const row = { url: cells[ui] };
    if (rest[0]) row.fullName = rest[0];
    if (rest[1]) row.company = rest[1];
    if (rest[2]) row.title = rest[2];
    out.push({ line: i + 1, raw, row });
  });
  return out;
}
function buildImportRows(items, opts, data) {
  const seen = new Set();
  const results = [];
  for (const it of items) {
    if (it.error) { results.push({ status: 'invalid', reason: it.error, line: it.line, raw: it.raw }); continue; }
    const r = it.row;
    const chk = checkLinkedIn(r.url);
    const norm = chk.ok ? chk : null;
    if (!norm) { results.push({ status: 'invalid', reason: chk.error, line: it.line, raw: String(r.url || '') }); continue; }
    if (seen.has(norm.key)) { results.push({ status: 'dupe', reason: 'Listed twice', line: it.line }); continue; }
    seen.add(norm.key);
    const existing = findProspect(opts.clientId, prospectDocId(norm.key));
    if (existing) { results.push({ status: 'exists', reason: 'Already in this client', line: it.line, name: fullName(existing) }); continue; }
    let first = String(r.firstName || '').trim(), last = String(r.lastName || '').trim();
    if (!first && r.fullName) { const s = splitName(r.fullName); first = s.firstName; last = last || s.lastName; }
    if (!first) { const s = nameFromSlug(norm.slug); first = s.firstName; last = last || s.lastName; }
    const tags = String(r.tags || '').split(/[,;|]/).map(t => t.trim()).filter(Boolean).concat(String(opts.tags || '').split(',').map(t => t.trim()).filter(Boolean));
    const elsewhere = data.prospects.some(x => x.urlKey === norm.key && x.clientId !== opts.clientId);
    results.push({
      status: first ? 'new' : 'noname', line: it.line, elsewhere,
      fields: { norm, firstName: first, lastName: last, title: r.title || '', position: r.position || positionFromHeadline(r.title), company: opts.cleanCompany ? cleanCompany(r.company || companyFromHeadline(r.title)) : (r.company || companyFromHeadline(r.title) || ''), location: r.location || '', email: r.email || '', notes: r.notes || '', tags: Array.from(new Set(tags)) },
    });
  }
  return results;
}
function BulkAddModal({ clientId }) {
  const data = currentData();
  const cid0 = defaultClientId(data, clientId);
  const c0 = data.clients[cid0];
  const [tab, setTab] = useState('paste');
  const [opts, setOpts] = useState({ clientId: cid0, senderId: c0 && c0.senders && c0.senders[0] ? c0.senders[0].id : '', sequenceId: (c0 && c0.defaultSequenceId) || (Object.values(data.seqs).find(s => !s.archived) || {}).id || '', tags: '', startOn: TODAY, alreadyConnected: false, cleanCompany: true, listId: '', newList: '' });
  const [paste, setPaste] = useState('');
  const [csv, setCsv] = useState(null);
  const [mapping, setMapping] = useState({});
  const [progress, setProgress] = useState(null);
  const [fileErr, setFileErr] = useState('');
  const client = data.clients[opts.clientId];
  const setO = k => e => setOpts(Object.assign({}, opts, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const items = useMemo(() => {
    if (tab === 'paste') return parsePastedLines(paste);
    if (!csv) return [];
    return csv.rows.map((r, i) => {
      const row = {};
      for (const f of IMPORT_FIELDS) if (mapping[f.key] !== undefined && mapping[f.key] !== '' && mapping[f.key] !== null) row[f.key] = r[mapping[f.key]];
      return row.url ? { line: i + 2, row } : { line: i + 2, error: 'No URL in the mapped column' };
    });
  }, [tab, paste, csv, mapping]);
  const results = useMemo(() => buildImportRows(items, opts, data), [items, opts.clientId, opts.tags, opts.cleanCompany, data]);
  const tally = { new: 0, exists: 0, dupe: 0, invalid: 0, noname: 0, elsewhere: 0 };
  results.forEach(r => { tally[r.status]++; if (r.elsewhere) tally.elsewhere++; });
  const onFile = async e => {
    const file = e.target.files && e.target.files[0];
    setFileErr('');
    if (!file) return;
    try {
      const rows = parseCSV(await readFileText(file));
      if (rows.length < 2) { setFileErr('That file has no data rows.'); return; }
      const header = rows[0].map(h => String(h).trim());
      const body = rows.slice(1);
      setCsv({ name: file.name, header, rows: body });
      setMapping(guessMapping(header, body));
    } catch (er) { setFileErr('Could not read that file. Save it as CSV (UTF-8) and try again.'); }
  };
  const run = async () => {
    const seq = data.seqs[opts.sequenceId];
    if (!seq || !opts.clientId) return;
    if (!W.guard()) return;
    const todo = results.filter(r => r.status === 'new');
    let listId = opts.listId;
    if (listId === '__new') {
      if (!opts.newList.trim()) { UI.toast('Name the new list first.', { bad: true }); return; }
      const l = await createList(opts.clientId, opts.newList); listId = l ? l.id : '';
    }
    setProgress({ done: 0, total: todo.length });
    const source = tab === 'paste' ? 'Pasted URLs' : 'CSV import';
    const docs = todo.map(r => newProspect(Object.assign({}, r.fields, { clientId: opts.clientId, senderId: opts.senderId, startOn: opts.startOn, alreadyConnected: opts.alreadyConnected, listId }), { seq, today: TODAY, by: me(), source }));
    const res = await W.many(docs, p => W.put(prospectPath(p), p, true), (d, t) => setProgress({ done: d, total: t }));
    UI.close();
    const ok = docs.length - res.failed;
    if (res.failed) UI.toast(ok + ' added, ' + res.failed + ' failed. Try importing again; existing ones are skipped.', { bad: true });
    else UI.toast(plural(ok, 'prospect') + ' added to ' + (client ? client.name : 'the client') + '.', { undo: () => W.many(docs, p => W.del(prospectPath(p), true)) });
  };
  const seq = data.seqs[opts.sequenceId];
  const perDay = client && (client.senders || []).find(s => s.id === opts.senderId);
  const daysNeeded = perDay && parseInt(perDay.dailyInvites, 10) > 0 && !opts.alreadyConnected ? Math.ceil(tally.new / parseInt(perDay.dailyInvites, 10)) : 0;
  return html`<${Modal} title="Add prospects in bulk" size="wide" sub="Duplicates are skipped automatically, so importing the same list twice is safe."
    foot=${progress ? html`<span class="left mono muted">Saving ${progress.done} of ${progress.total}…</span>` : html`
      <button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button>
      <button type="button" class="btn primary" disabled=${!tally.new || !seq || !opts.clientId} onClick=${run}>Add ${tally.new ? plural(tally.new, 'prospect') : 'prospects'}</button>`}>
    <div class="fields">
      <label class="field"><span>Client</span><${ClientSelect} id="b-client" data=${data} value=${opts.clientId} onChange=${x => { const c = data.clients[x]; setOpts(Object.assign({}, opts, { listId: '', clientId: x, senderId: c && c.senders && c.senders[0] ? c.senders[0].id : '', sequenceId: (c && c.defaultSequenceId) || opts.sequenceId })); }} /></label>
      <label class="field"><span>LinkedIn account</span><select id="b-sender" class="select" value=${opts.senderId} onChange=${setO('senderId')}>
        ${((client && client.senders) || []).map(s => html`<option key=${s.id} value=${s.id} selected=${opts.senderId === s.id}>${s.name}</option>`)}
      </select></label>
      <label class="field"><span>Sequence</span><${SequenceSelect} id="b-seq" data=${data} clientId=${opts.clientId} value=${opts.sequenceId} onChange=${x => setOpts(Object.assign({}, opts, { sequenceId: x }))} /></label>
      <label class="field"><span>Start date</span><input id="b-start" type="date" class="input" value=${opts.startOn} onInput=${setO('startOn')} /></label>
      <label class="field"><span>Add to list</span><${ListSelect} id="b-list" data=${data} clientId=${opts.clientId} value=${opts.listId} allowNew=${true} onChange=${x => { const l = listsOf(data, opts.clientId).find(y => y.id === x); setOpts(Object.assign({}, opts, { listId: x, sequenceId: l && l.sequenceId && data.seqs[l.sequenceId] ? l.sequenceId : opts.sequenceId })); }} />
        ${opts.listId === '__new' && html`<input id="b-newlist" class="input" style="margin-top:6px" placeholder="New list name, e.g. Webinar attendees" value=${opts.newList} onInput=${setO('newList')} />`}</label>
      <label class="field"><span>Tag everyone <span class="hint">optional, comma separated</span></span><input id="b-tags" class="input" placeholder="october-list" value=${opts.tags} onInput=${setO('tags')} /></label>
    </div>
    <div class="btn-row">
      <label class="check"><input id="b-connected" type="checkbox" checked=${opts.alreadyConnected} onChange=${setO('alreadyConnected')} />Already connected (skip the invite)</label>
      <label class="check"><input id="b-clean" type="checkbox" checked=${opts.cleanCompany} onChange=${setO('cleanCompany')} />Tidy company names ("Acme Inc." → "Acme")</label>
    </div>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected=${tab === 'paste' ? 'true' : 'false'} onClick=${() => setTab('paste')}>Paste LinkedIn URLs</button>
      <button type="button" role="tab" aria-selected=${tab === 'csv' ? 'true' : 'false'} onClick=${() => setTab('csv')}>Import CSV</button>
    </div>
    ${tab === 'paste' ? html`
      <label class="field"><span>One per line <span class="hint">URL only, or "URL, Full name, Company, Title"</span></span>
        <textarea id="b-paste" class="textarea" style="min-height:150px;font-family:var(--font-mono);font-size:12.5px" data-autofocus
          placeholder=${'https://www.linkedin.com/in/jane-doe\nlinkedin.com/in/raj-patel-4b2a1, Raj Patel, Northwind, Head of Growth'} value=${paste} onInput=${e => setPaste(e.target.value)}></textarea></label>
      <p class="hint muted" style="font-size:12.5px">Names are read from the URL when you don't give one (linkedin.com/in/jane-doe-12ab → Jane Doe). Check them before messaging.</p>`
    : html`
      <label class="field"><span>CSV file <span class="hint">exports from Sales Navigator tools, Apollo, Clay or a spreadsheet all work</span></span>
        <input id="b-file" type="file" accept=".csv,text/csv,.tsv,text/plain" class="input" onChange=${onFile} /></label>
      ${fileErr && html`<div class="note-box bad">${fileErr}</div>`}
      ${csv && html`<div class="stack">
        <p class="soft" style="font-size:13px">${csv.name}: ${fmtNum(csv.rows.length)} rows. Match the columns:</p>
        <div class="map-grid">
          ${IMPORT_FIELDS.map(f => html`<label class="field" key=${f.key}><span>${f.label}${f.required ? ' *' : ''}</span>
            <select id=${'map-' + f.key} class="select sm" value=${mapping[f.key] === undefined ? '' : String(mapping[f.key])} onChange=${e => setMapping(Object.assign({}, mapping, { [f.key]: e.target.value === '' ? undefined : parseInt(e.target.value, 10) }))}>
              <option value="" selected=${mapping[f.key] === undefined}>Not in file</option>
              ${csv.header.map((h, i) => html`<option key=${i} value=${String(i)} selected=${mapping[f.key] === i}>${h || 'Column ' + (i + 1)}</option>`)}
            </select></label>`)}
        </div>
      </div>`}`}
    ${results.length > 0 && html`<div class="stack">
      <div class="counts-row">
        <span class="pill tone-good">${tally.new} new</span>
        ${tally.exists > 0 && html`<span class="pill tone-neutral">${tally.exists} already in this client</span>`}
        ${tally.dupe > 0 && html`<span class="pill tone-neutral">${tally.dupe} listed twice</span>`}
        ${tally.invalid > 0 && html`<span class="pill tone-overdue">${tally.invalid} without a valid URL</span>`}
        ${tally.noname > 0 && html`<span class="pill tone-overdue">${tally.noname} without a name (skipped)</span>`}
        ${tally.elsewhere > 0 && html`<span class="pill tone-today">${tally.elsewhere} also prospects of another client</span>`}
      </div>
      ${tally.invalid > 0 && html`<div class="note-box bad"><strong>Skipped: not real LinkedIn profile links</strong>
        <ul class="bad-list">${results.filter(r => r.status === 'invalid').slice(0, 8).map(r => html`<li key=${r.line}><span class="mono">Line ${r.line}</span> ${r.raw ? html`<span class="mono muted">${String(r.raw).slice(0, 60)}</span>` : ''} · ${r.reason}</li>`)}</ul>
        ${tally.invalid > 8 && html`<span class="muted">…and ${tally.invalid - 8} more.</span>`}</div>`}
      ${daysNeeded > 1 && html`<p class="soft" style="font-size:13px">At ${perDay.dailyInvites} invites a day for ${perDay.name}, these invites spread over about ${daysNeeded} working days. The Today list paces them for you.</p>`}
      <div class="preview-table"><table>
        <thead><tr><th>Name</th><th>Position</th><th>Company</th><th>LinkedIn</th></tr></thead>
        <tbody>${results.filter(r => r.status === 'new').slice(0, 6).map((r, i) => html`<tr key=${i}><td>${r.fields.firstName} ${r.fields.lastName}</td><td>${r.fields.position}</td><td>${r.fields.company}</td><td class="mono">${r.fields.norm.slug || r.fields.norm.key}</td></tr>`)}</tbody>
      </table></div>
    </div>`}
  <//>`;
}

/* ---------- move to another sequence ---------- */
function ChangeSequenceModal({ ps }) {
  const data = currentData();
  const list = (ps || []).map(fresh);
  const first = list[0];
  const [sid, setSid] = useState(first ? first.sequenceId || '' : '');
  const seq = data.seqs[sid];
  const curIdx = first && data.seqs[first.sequenceId] ? stepIndexOf(first, data.seqs[first.sequenceId]) : 0;
  const [idx, setIdx] = useState(curIdx);
  useEffect(() => { if (seq) setIdx(Math.min(idx, seq.steps.length - 1 < 0 ? 0 : seq.steps.length - 1)); }, [sid]);
  const apply = async () => {
    if (!seq) return;
    UI.close();
    if (list.length === 1) await Act.changeSequence(list[0], seq, idx);
    else await Act.bulk(list, p => actChangeSequence(p, seq, idx, TODAY, me()), n => plural(n, 'prospect') + ' moved to ' + seq.name + '.');
  };
  return html`<${Modal} title="Move to a sequence" sub=${list.length === 1 ? fullName(first) : plural(list.length, 'prospect')} size="narrow"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button><button type="button" class="btn primary" disabled=${!seq} onClick=${apply}>Move</button>`}>
    <label class="field"><span>Sequence</span><${SequenceSelect} id="cs-seq" data=${data} value=${sid} onChange=${setSid} /></label>
    ${seq && html`<label class="field"><span>Continue from</span><select id="cs-step" class="select" value=${String(idx)} onChange=${e => setIdx(parseInt(e.target.value, 10))}>
      ${seq.steps.map((s, i) => html`<option key=${s.id} value=${String(i)} selected=${idx === i}>Step ${i + 1}: ${stepTitle(seq, i)}</option>`)}
    </select><span class="hint">Finished steps keep their history. The chosen step is scheduled from the last thing sent.</span></label>`}
  <//>`;
}

/* ---------- lists (per client) ---------- */
function SetListModal({ ps }) {
  const data = currentData();
  const list = (ps || []).map(fresh);
  const clientIds = Array.from(new Set(list.map(p => p.clientId)));
  const cid = clientIds[0];
  const [val, setVal] = useState(list.length === 1 ? (list[0].listId || '') : '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  if (clientIds.length > 1) {
    return html`<${Modal} title="Add to a list" size="narrow" foot=${html`<button type="button" class="btn primary" onClick=${() => UI.close()}>OK</button>`}>
      <p class="soft">Lists belong to one client. Your selection spans ${plural(clientIds.length, 'client')}; filter Prospects by one client, then try again.</p><//>`;
  }
  const apply = async () => {
    setBusy(true);
    let id = val, nm = listName(data, cid, val);
    if (val === '__new') { const l = await createList(cid, name); if (!l) { setBusy(false); return; } id = l.id; nm = l.name; }
    UI.close();
    if (list.length === 1) await Act.setList(list[0], id, nm);
    else await Act.bulk(list, p => actSetList(p, id, nm, TODAY, me()), n => plural(n, 'prospect') + (id ? ' added to ' + nm : ' removed from their list') + '.');
  };
  return html`<${Modal} title=${list.length === 1 ? 'List for ' + fullName(list[0]) : 'Add ' + plural(list.length, 'prospect') + ' to a list'} sub=${(data.clients[cid] || {}).name} size="narrow"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button><button type="button" class="btn primary" disabled=${busy || (val === '__new' && !name.trim())} onClick=${apply}>Save</button>`}>
    <label class="field"><span>List</span><${ListSelect} id="sl-list" data=${data} clientId=${cid} value=${val} allLabel="Not in a list" allowNew=${true} onChange=${setVal} /></label>
    ${val === '__new' && html`<label class="field"><span>New list name</span><input id="sl-name" class="input" data-autofocus placeholder="e.g. Fintech CFOs, London" value=${name} onInput=${e => setName(e.target.value)} /></label>`}
  <//>`;
}

function ListsModal({ clientId }) {
  const data = currentData();
  const client = data.clients[clientId];
  const [rows, setRows] = useState(() => clone((client && client.lists) || []));
  const [name, setName] = useState('');
  const [seqId, setSeqId] = useState('');
  const [busy, setBusy] = useState(false);
  if (!client) return null;
  const count = id => data.prospects.filter(p => p.clientId === clientId && p.listId === id).length;
  const set = (i, k, v) => { const r = rows.slice(); r[i] = Object.assign({}, r[i], { [k]: v }); setRows(r); };
  const add = e => { e.preventDefault(); if (!name.trim()) return; setRows(rows.concat({ id: uid('ls'), name: name.trim(), sequenceId: seqId || null, createdAt: nowTs() })); setName(''); setSeqId(''); };
  const save = async () => {
    if (!W.guard()) return;
    setBusy(true);
    const kept = rows.filter(r => String(r.name || '').trim()).map(r => Object.assign({}, r, { name: r.name.trim() }));
    const removed = (client.lists || []).filter(l => !kept.some(k => k.id === l.id)).map(l => l.id);
    const ok = await W.saveClient(Object.assign(clone(client), { lists: kept, updatedAt: nowTs() }));
    if (ok && removed.length) {
      const orphans = data.prospects.filter(p => p.clientId === clientId && removed.indexOf(p.listId) !== -1);
      await W.many(orphans, p => W.put(prospectPath(p), Object.assign(clone(p), { listId: null }), true));
    }
    setBusy(false);
    if (ok) { UI.close(); UI.toast('Lists saved for ' + client.name + '.'); }
  };
  return html`<${Modal} title=${'Lists · ' + client.name} sub="Group this client's prospects by campaign, segment or source. A list can start everyone added to it on its own sequence." size="wide"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button><button type="button" class="btn primary" disabled=${busy} onClick=${save}>Save lists</button>`}>
    ${rows.length === 0 ? html`<p class="muted">No lists yet. Create the first one below.</p>` : html`<div class="stack">
      ${rows.map((r, i) => html`<div class="list-edit" key=${r.id}>
        <label class="field"><span>Name</span><input id=${'le-n-' + i} class="input sm" value=${r.name} onInput=${e => set(i, 'name', e.target.value)} /></label>
        <label class="field"><span>Default sequence</span><${SequenceSelect} id=${'le-s-' + i} cls="select sm" data=${data} clientId=${clientId} value=${r.sequenceId || ''} allowEmpty="Client default" onChange=${v => set(i, 'sequenceId', v || null)} /></label>
        <span class="mono muted" style="align-self:end;padding-bottom:7px">${plural(count(r.id), 'prospect')}</span>
        <button type="button" class="btn sm ghost icon" style="align-self:end" aria-label=${'Delete list ' + r.name} title="Delete list (prospects stay, just unlisted)" onClick=${() => setRows(rows.filter((x, j) => j !== i))}><${Icon} n="trash" s=${14} /></button>
      </div>`)}
    </div>`}
    <form class="list-edit add" onSubmit=${add}>
      <label class="field"><span>New list</span><input id="le-new" class="input sm" data-autofocus placeholder="e.g. Series A founders" value=${name} onInput=${e => setName(e.target.value)} /></label>
      <label class="field"><span>Default sequence</span><${SequenceSelect} id="le-new-s" cls="select sm" data=${data} clientId=${clientId} value=${seqId} allowEmpty="Client default" onChange=${setSeqId} /></label>
      <span></span>
      <button type="submit" class="btn sm" style="align-self:end" disabled=${!name.trim()}><${Icon} n="plus" s=${14} />Add</button>
    </form>
  <//>`;
}
