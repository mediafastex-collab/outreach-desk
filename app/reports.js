/* Fastex Outreach Desk — reports.js
   Results per client and period, computed from the activity log. */
'use strict';

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

function ActivityChart({ series }) {
  const [hover, setHover] = useState(-1);
  const [asTable, setAsTable] = useState(false);
  const pts = series.points;
  const W0 = 720, H = 220, padL = 36, padR = 8, padT = 12, padB = 28;
  const innerW = W0 - padL - padR, innerH = H - padT - padB;
  const max = niceMax(Math.max(1, ...pts.map(p => p.invites + p.messages)));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const band = innerW / Math.max(1, pts.length);
  const barW = Math.max(3, Math.min(24, band - 4));
  const y = v => padT + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(pts.length / 8);
  const r = Math.min(4, barW / 2);
  /* A column with a rounded top only; square at the baseline. */
  const colPath = (x, top, h) => {
    if (h <= 0) return '';
    const rr = Math.min(r, h);
    return 'M' + x + ',' + (top + h) + 'V' + (top + rr) + 'Q' + x + ',' + top + ' ' + (x + rr) + ',' + top + 'H' + (x + barW - rr) + 'Q' + (x + barW) + ',' + top + ' ' + (x + barW) + ',' + (top + rr) + 'V' + (top + h) + 'Z';
  };
  const tip = hover >= 0 ? pts[hover] : null;
  const tipLeft = hover >= 0 ? Math.min(Math.max(((padL + band * hover + band / 2) / W0) * 100, 12), 80) : 0;
  return html`<section class="panel">
    <div class="panel-head">
      <h3>Daily activity${series.weekly ? ' (weekly)' : ''}</h3>
      <div class="btn-row">
        <div class="legend"><span><i style="background:var(--series-1)"></i>Invites sent</span><span><i style="background:var(--series-2)"></i>Messages sent</span></div>
        <div class="seg"><button type="button" aria-pressed=${!asTable ? 'true' : 'false'} onClick=${() => setAsTable(false)}>Chart</button><button type="button" aria-pressed=${asTable ? 'true' : 'false'} onClick=${() => setAsTable(true)}>Table</button></div>
      </div>
    </div>
    ${asTable ? html`<div class="table-wrap" style="max-height:320px;overflow-y:auto"><table class="data">
        <thead><tr><th>${series.weekly ? 'Week of' : 'Day'}</th><th class="n">Invites</th><th class="n">Messages</th><th class="n">Total</th></tr></thead>
        <tbody>${pts.slice().reverse().map(p => html`<tr key=${p.date}><td>${fmtDay(p.date)}</td><td class="n">${p.invites}</td><td class="n">${p.messages}</td><td class="n">${p.invites + p.messages}</td></tr>`)}</tbody>
      </table></div>`
    : html`<div class="chart" onMouseLeave=${() => setHover(-1)}>
      <svg viewBox=${'0 0 ' + W0 + ' ' + H} role="img" aria-label="Invites and messages sent per day">
        ${ticks.map((tv, i) => html`<g key=${'t' + i}>
          <line x1=${padL} x2=${W0 - padR} y1=${y(tv)} y2=${y(tv)} stroke=${i === 0 ? 'var(--axis)' : 'var(--grid)'} stroke-width="1" />
          <text x=${padL - 6} y=${y(tv) + 4} text-anchor="end" font-size="11" fill="var(--ink-3)" style="font-variant-numeric:tabular-nums">${Math.round(tv)}</text>
        </g>`)}
        ${pts.map((p, i) => {
          const x = padL + band * i + (band - barW) / 2;
          const hInv = (p.invites / max) * innerH;
          const hMsg = (p.messages / max) * innerH;
          const gap = hInv > 0 && hMsg > 0 ? 2 : 0;
          const topInv = padT + innerH - hInv;
          const topMsg = topInv - hMsg;
          const msgH = hMsg - gap;
          return html`<g key=${p.date} opacity=${hover === -1 || hover === i ? 1 : 0.55}>
            ${hMsg > 0 && hInv === 0 && html`<path d=${colPath(x, padT + innerH - hMsg, hMsg)} fill="var(--series-2)" />`}
            ${hInv > 0 && html`<path d=${hMsg > 0 ? 'M' + x + ',' + (padT + innerH) + 'V' + topInv + 'H' + (x + barW) + 'V' + (padT + innerH) + 'Z' : colPath(x, topInv, hInv)} fill="var(--series-1)" />`}
            ${msgH > 0 && hInv > 0 && html`<path d=${colPath(x, topMsg, msgH)} fill="var(--series-2)" />`}
            <rect x=${padL + band * i} y=${padT} width=${band} height=${innerH} fill="transparent"
              tabindex="0" aria-label=${fmtDay(p.date) + ': ' + p.invites + ' invites, ' + p.messages + ' messages'}
              onMouseEnter=${() => setHover(i)} onFocus=${() => setHover(i)} onBlur=${() => setHover(-1)} />
            ${i % labelEvery === 0 && html`<text x=${padL + band * i + band / 2} y=${H - 8} text-anchor="middle" font-size="11" fill="var(--ink-3)">${p.label}</text>`}
          </g>`;
        })}
      </svg>
      ${tip && html`<div class="tip" style=${{ left: tipLeft + '%', top: '8px', transform: 'translateX(-50%)' }}>
        <div class="muted" style="margin-bottom:4px">${series.weekly ? 'Week of ' : ''}${fmtDay(tip.date)}</div>
        <div class="tip-row"><span class="key" style="background:var(--series-1)"></span><span class="tv">${tip.invites}</span><span class="muted">invites</span></div>
        <div class="tip-row"><span class="key" style="background:var(--series-2)"></span><span class="tv">${tip.messages}</span><span class="muted">messages</span></div>
      </div>`}
    </div>`}
  </section>`;
}

function HBars({ title, rows, color, empty, note }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return html`<section class="panel">
    <div class="panel-head"><h3>${title}</h3>${note && html`<span class="muted" style="font-size:12px">${note}</span>`}</div>
    ${rows.length === 0 ? html`<p class="panel-pad muted">${empty}</p>` : html`<div class="hbars">
      ${rows.map(([label, v]) => html`<div class="hbar" key=${label}>
        <span class="lab" title=${label}>${label}</span>
        <span class="track"><span class="bar" style=${{ width: Math.max(1.5, (v / max) * 100) + '%', background: color }}></span></span>
        <span class="val">${fmtNum(v)}</span>
      </div>`)}
    </div>`}
  </section>`;
}

function ReportsView() {
  const data = currentData();
  const f = UI.reportFilter;
  const setF = patch => UI.set({ reportFilter: Object.assign({}, f, patch) });
  const range = periodRange(f.period, TODAY);
  const ps = useMemo(() => data.prospects.filter(p => !f.clientId || p.clientId === f.clientId), [data, f.clientId]);
  const a = useMemo(() => analyze(ps, range), [ps, f.period, TODAY]);
  const series = useMemo(() => dailySeries(a, range, TODAY), [a]);
  const sc = useMemo(() => statusCounts(ps), [ps]);
  const client = f.clientId ? data.clients[f.clientId] : null;
  const perClient = useMemo(() => {
    if (f.clientId) return [];
    return Object.values(data.clients).filter(c => c.status !== 'archived').map(c => {
      const cps = data.prospects.filter(p => p.clientId === c.id);
      return { c, a: analyze(cps, range), sc: statusCounts(cps) };
    }).sort((x, y) => byText(x.c.name, y.c.name));
  }, [data, f.clientId, f.period, TODAY]);
  const replyRows = Object.entries(a.replyAfter).sort((x, y) => y[1] - x[1]);
  const funnel = [['Invites sent', a.funnel.invited], ['Accepted', a.funnel.accepted], ['Replied', a.funnel.replied], ['Positive', a.funnel.positive], ['Meeting booked', a.funnel.meeting]];
  const members = Object.entries(a.members).map(([id, m]) => ({ id, name: id === '_' ? 'Not signed' : memberName(data.settings, id) || 'Former teammate', m })).sort((x, y) => (y.m.invites + y.m.messages) - (x.m.invites + x.m.messages));
  const kpi = (k, v, s) => html`<div class="panel kpi"><span class="k">${k}</span><span class="v">${fmtNum(v)}</span>${s && html`<span class="s">${s}</span>`}</div>`;
  const title = client ? client.name : (data.settings.agencyName || 'All clients');
  return html`<div class="page">
    <header class="page-head">
      <div><p class="eyebrow">${range.label}${range.from ? ' · ' + fmtShort(range.from) + ' to ' + fmtShort(range.to) : ''}</p><h1>Reports</h1>
        <p class="lede">What happened in the period, per client.</p></div>
      <div class="head-actions"><${HelpButton} view="reports" /><button type="button" class="btn" onClick=${() => copyText(reportText(title, range, a, sc), 'Report')}><${Icon} n="copy" s=${14} />Copy ${client ? 'client' : ''} report</button></div>
    </header>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Period">
        ${[['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['all', 'All time']].map(([k, l]) => html`<button type="button" key=${k} aria-pressed=${f.period === k ? 'true' : 'false'} onClick=${() => setF({ period: k })}>${l}</button>`)}
      </div>
      <${ClientSelect} id="r-client" cls="select sm" data=${data} value=${f.clientId} all=${true} includeInactive=${true} onChange=${v => setF({ clientId: v })} />
    </div>
    <div class="kpis">
      ${kpi('Invites sent', a.k.invites, a.funnel.invited ? fmtPct(a.acceptRate) + ' accepted so far' : 'No invites in this period')}
      ${kpi('New connections', a.k.accepted, null)}
      ${kpi('Messages sent', a.k.messages, a.k.touches ? plural(a.k.touches, 'other touch', 'other touches') : null)}
      ${kpi('Replies', a.k.replies, a.msgCohort ? fmtPct(a.replyRate) + ' reply rate' : null)}
      ${kpi('Meetings booked', a.k.meetings, a.k.positive ? plural(a.k.positive, 'positive reply', 'positive replies') : null)}
    </div>
    <div class="report-grid">
      <${ActivityChart} series=${series} />
      <${HBars} title="Funnel" note="People invited in this period" rows=${funnel.filter(x => funnel[0][1] > 0)} color="var(--accent)" empty="No invites were sent in this period." />
    </div>
    <div class="report-grid">
      <${HBars} title="Which step got the reply" rows=${replyRows} color="var(--series-reply)" empty="No replies in this period yet." note="Last step sent before they replied" />
      <section class="panel">
        <div class="panel-head"><h3>Team activity</h3></div>
        ${members.length === 0 ? html`<p class="panel-pad muted">No activity in this period.</p>` : html`<div class="table-wrap"><table class="data">
          <thead><tr><th>Person</th><th class="n">Invites</th><th class="n">Messages</th><th class="n">Touches</th><th class="n">Outcomes</th></tr></thead>
          <tbody>${members.map(x => html`<tr key=${x.id}><td>${x.name}</td><td class="n">${x.m.invites}</td><td class="n">${x.m.messages}</td><td class="n">${x.m.touches}</td><td class="n">${x.m.handled}</td></tr>`)}</tbody>
        </table></div>`}
      </section>
    </div>
    ${perClient.length > 0 && html`<section class="panel">
      <div class="panel-head"><h3>Clients compared</h3><span class="muted" style="font-size:12px">${range.label}</span></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Client</th><th class="n">Invites</th><th class="n">Acceptance</th><th class="n">Messages</th><th class="n">Replies</th><th class="n">Reply rate</th><th class="n">Meetings</th><th class="n">Pending now</th><th class="n">In progress</th><th></th></tr></thead>
        <tbody>${perClient.map(({ c, a: ca, sc: csc }) => html`<tr key=${c.id}>
          <td><${ClientChip} client=${c} /></td>
          <td class="n">${ca.k.invites}</td><td class="n">${fmtPct(ca.acceptRate)}</td><td class="n">${ca.k.messages}</td>
          <td class="n">${ca.k.replies}</td><td class="n">${fmtPct(ca.replyRate)}</td><td class="n">${ca.k.meetings}</td>
          <td class="n">${csc.invited}</td><td class="n">${csc.active + csc.queued}</td>
          <td><button type="button" class="btn sm ghost" onClick=${() => copyText(reportText(c.name, range, ca, csc), c.name + ' report')}><${Icon} n="copy" s=${14} />Report</button></td>
        </tr>`)}</tbody>
      </table></div>
    </section>`}
  </div>`;
}
