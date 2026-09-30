/* Fastex Outreach Desk — activity.js
   Everything the team did, newest first, with type, date and time. */
'use strict';

function ActivityView() {
  const data = currentData();
  const f = UI.activityFilter;
  const setF = patch => { UI.set({ activityFilter: Object.assign({}, f, patch) }); setLimit(150); };
  const [limit, setLimit] = useState(150);
  const range = f.period === 'today' ? { from: TODAY, to: TODAY } : periodRange(f.period, TODAY);
  const inR = on => (!range.from || on >= range.from) && on <= (range.to || TODAY);
  const entries = useMemo(() => {
    const out = [];
    for (const p of data.prospects) {
      if (f.clientId && p.clientId !== f.clientId) continue;
      if (f.clientId && f.listId && (f.listId === '_none' ? p.listId : p.listId !== f.listId)) continue;
      for (const e of p.log || []) {
        if (!inR(e.on)) continue;
        if (f.memberId && e.by !== f.memberId) continue;
        out.push({ e, p, kind: activityKind(e), ts: e.ts || e.on });
      }
    }
    out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    return out;
  }, [data, f.clientId, f.listId, f.memberId, f.period, TODAY]);
  const byKind = {};
  entries.forEach(x => { byKind[x.kind] = (byKind[x.kind] || 0) + 1; });
  const shown = f.kind ? entries.filter(x => x.kind === f.kind) : entries;
  const days = [];
  shown.slice(0, limit).forEach(x => {
    const last = days[days.length - 1];
    if (last && last.on === x.e.on) last.items.push(x); else days.push({ on: x.e.on, items: [x] });
  });
  const order = ['added', 'invite', 'message', 'touch', 'accepted', 'replied', 'status', 'reminder', 'withdrawn', 'note', 'admin'];
  const exportCSV = () => saveFile('activity-' + TODAY + '.csv', toCSV([['Date', 'Time', 'Type', 'Activity', 'Prospect', 'Company', 'Client', 'List', 'By', 'Note']].concat(shown.map(x => [
    x.e.on, x.e.ts ? fmtTime(x.e.ts) : '', ACTIVITY_KINDS[x.kind].label, activityText(x.e), fullName(x.p), x.p.company || '',
    (data.clients[x.p.clientId] || {}).name || '', listName(data, x.p.clientId, x.p.listId), memberName(data.settings, x.e.by), activityNote(x.e),
  ]))));
  return html`<div class="page">
    <header class="page-head">
      <div><p class="eyebrow">${f.period === 'today' ? fmtLong(TODAY) : range.label}</p><h1>Activity</h1>
        <p class="lede">Every invite, message, acceptance, reply and outcome, with the date and time it was logged and who logged it.</p></div>
      <div class="head-actions"><button type="button" class="btn" disabled=${!shown.length} onClick=${exportCSV}><${Icon} n="download" s=${14} />Export CSV</button></div>
    </header>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Period">
        ${[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']].map(([k, l]) => html`<button type="button" key=${k} aria-pressed=${f.period === k ? 'true' : 'false'} onClick=${() => setF({ period: k })}>${l}</button>`)}
      </div>
      <${ClientSelect} id="act-client" cls="select sm" data=${data} value=${f.clientId} all=${true} includeInactive=${true} onChange=${v => setF({ clientId: v, listId: '' })} />
      ${f.clientId && listsOf(data, f.clientId).length > 0 && html`<${ListSelect} id="act-list" cls="select sm" data=${data} clientId=${f.clientId} value=${f.listId} allLabel="All lists" onChange=${v => setF({ listId: v })} />`}
      ${(data.settings.team || []).length > 0 && html`<${MemberSelect} id="act-member" cls="select sm" settings=${data.settings} value=${f.memberId} all=${true} allLabel="Everyone" onChange=${v => setF({ memberId: v })} />`}
    </div>
    <div class="status-strip" role="group" aria-label="Activity type">
      <button type="button" aria-pressed=${!f.kind ? 'true' : 'false'} onClick=${() => setF({ kind: '' })}>All<span class="n">${entries.length}</span></button>
      ${order.filter(k => byKind[k]).map(k => html`<button type="button" key=${k} aria-pressed=${f.kind === k ? 'true' : 'false'} onClick=${() => setF({ kind: f.kind === k ? '' : k })}>
        <span class=${'dot tone-' + ACTIVITY_KINDS[k].tone} style="background:currentColor"></span>${ACTIVITY_KINDS[k].label}<span class="n">${byKind[k]}</span></button>`)}
    </div>
    ${!shown.length ? html`<div class="panel"><${Empty} icon="activity" title="No activity in this view">Work the Today list and everything you log shows up here, with its time.</${Empty}></div>`
    : html`<div class="stack-lg">${days.map(d => html`<section class="panel" key=${d.on}>
        <div class="panel-head"><h3>${fmtLong(d.on)}</h3><span class="mono muted">${d.items.length}</span></div>
        <ul class="acts feed">${d.items.map((x, i) => html`<li class="act" key=${i}>
          <span class="act-time mono">${x.e.ts ? fmtTime(x.e.ts) : '–'}</span>
          <span class=${'act-ic tone-' + ACTIVITY_KINDS[x.kind].tone}><${Icon} n=${ACTIVITY_KINDS[x.kind].icon} s=${13} /></span>
          <div class="act-body">
            <div class="act-text"><button type="button" class="linkish strong" onClick=${() => UI.openProspect(x.p)}>${fullName(x.p)}</button>
              <span class="muted"> · ${x.p.company || ''}</span></div>
            <div class="act-text">${activityText(x.e)}${x.e.by && memberName(data.settings, x.e.by) ? html` <span class="muted">· by ${memberName(data.settings, x.e.by)}</span>` : ''}</div>
            ${activityNote(x.e) && html`<div class="act-note">${activityNote(x.e)}</div>`}
          </div>
          <span class="act-client"><${ClientChip} client=${data.clients[x.p.clientId]} /></span>
        </li>`)}</ul>
      </section>`)}
      ${shown.length > limit && html`<button type="button" class="btn" style="align-self:flex-start" onClick=${() => setLimit(limit + 300)}>Show more (${fmtNum(shown.length - limit)} left)</button>`}
    </div>`}
  </div>`;
}
