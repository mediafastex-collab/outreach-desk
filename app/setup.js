/* Fastex Outreach Desk — setup.js
   Clients (with their LinkedIn sending accounts), sequences, and settings. */
'use strict';

/* ---------- clients ---------- */
function ensureDefaultSequence() {
  const data = currentData();
  const live = Object.values(data.seqs).filter(s => !s.archived);
  if (live.length) return Promise.resolve(live.sort((a, b) => byText(a.createdAt, b.createdAt))[0]);
  const seq = makeSequence('standard');
  return W.saveSequence(seq).then(ok => (ok ? seq : null));
}

function ClientCard({ c, data, usage, board }) {
  const ps = data.prospects.filter(p => p.clientId === c.id);
  const sc = statusCounts(ps);
  const a30 = analyze(ps, periodRange('30d', TODAY));
  const accts = board.accounts.filter(a => a.client.id === c.id);
  const due = accts.reduce((n, a) => n + a.tasks.length, 0) + board.replies.filter(r => r.client.id === c.id).length;
  const seq = data.seqs[c.defaultSequenceId];
  const mgr = memberName(data.settings, c.ownerId);
  const pendingBy = {};
  ps.forEach(p => { if (p.status === 'invited') pendingBy[p.senderId || 'none'] = (pendingBy[p.senderId || 'none'] || 0) + 1; });
  const setStatus = status => W.guard() && W.saveClient(Object.assign({}, c, { status, updatedAt: nowTs() })).then(ok => ok && UI.toast(c.name + ' is now ' + status + '.'));
  return html`<article class="panel client-card">
    <div class="top">
      <div class="name">
        <span style="display:flex;gap:10px;align-items:center;min-width:0"><span class=${'swatch-dot c' + ((c.colorIdx | 0) % CLIENT_COLORS)} style="background:currentColor"></span><h3>${c.name}</h3></span>
        ${c.status && c.status !== 'active' ? html`<span class="pill tone-neutral">${c.status === 'paused' ? 'Paused' : 'Archived'}</span>` : due > 0 && html`<span class="pill tone-today">${plural(due, 'task')} today</span>`}
      </div>
      <p class="muted" style="font-size:12.5px">${mgr ? 'Managed by ' + mgr + ' · ' : ''}${seq ? seq.name : 'No default sequence'}</p>
      ${c.notes && html`<p class="soft" style="font-size:13px">${c.notes}</p>`}
    </div>
    <div class="pipe">
      <div><span class="v num">${sc.invited}</span><span class="k">Invites pending</span></div>
      <div><span class="v num">${sc.active + sc.queued}</span><span class="k">In progress</span></div>
      <div><span class="v num">${sc.replied + sc.interested + sc.nurture}</span><span class="k">Conversations</span></div>
      <div><span class="v num">${sc.meeting}</span><span class="k">Meetings</span></div>
    </div>
    <div class="sender-list">
      ${(c.senders || []).map(s => {
        const u = usage[c.id + '|' + s.id] || emptyUsage();
        const d = parseInt(s.dailyInvites, 10) || 0, w = parseInt(s.weeklyInvites, 10) || 0;
        const op = memberName(data.settings, s.ownerId);
        return html`<div class="sender" key=${s.id}>
          <div class="row1"><strong>${s.name}</strong>${s.url && html`<a href=${s.url} target="_blank" rel="noopener noreferrer" style="font-size:12.5px">Profile</a>`}</div>
          <div class="row2">
            ${op && html`<span>run by ${op}</span>`}
            ${d > 0 && html`<${Meter} label="Today" v=${u.invitesToday} max=${d} />`}
            ${w > 0 && html`<${Meter} label="7 days" v=${u.invitesWeek} max=${w} />`}
            <span class="num">${pendingBy[s.id] || 0} pending</span>
          </div>
        </div>`;
      })}
      ${!(c.senders || []).length && html`<div class="sender"><span class="muted">No LinkedIn accounts yet. Edit the client to add one.</span></div>`}
    </div>
    <div class="cc-rows">
      <div class="cc-row"><span class="k"><${Icon} n="route" s=${13} />Sequences</span>
        <span class="v">${Object.values(data.seqs).filter(x => x.clientId === c.id && !x.archived).map(x => html`<button type="button" key=${x.id} class="linkish" onClick=${() => UI.go('sequences', { seqSelected: x.id, seqScope: c.id })}>${x.name}${c.defaultSequenceId === x.id ? ' (default)' : ''}</button>`)}
          ${!Object.values(data.seqs).some(x => x.clientId === c.id && !x.archived) && html`<span class="muted">Shared: ${seq ? seq.name : 'none'}</span>`}
          <button type="button" class="btn sm ghost" onClick=${() => UI.open('newSeq', { clientId: c.id })}><${Icon} n="plus" s=${13} />New</button></span></div>
      <div class="cc-row"><span class="k"><${Icon} n="list" s=${13} />Lists</span>
        <span class="v">${(c.lists || []).map(l => html`<button type="button" key=${l.id} class="linkish" onClick=${() => UI.go('prospects', { prospectFilter: Object.assign({}, UI.prospectFilter, { clientId: c.id, listId: l.id, senderId: '', status: '' }) })}>${l.name} (${ps.filter(p => p.listId === l.id).length})</button>`)}
          <button type="button" class="btn sm ghost" onClick=${() => UI.open('lists', { clientId: c.id })}><${Icon} n=${(c.lists || []).length ? 'edit' : 'plus'} s=${13} />${(c.lists || []).length ? 'Manage' : 'New list'}</button></span></div>
    </div>
    <div class="panel-pad" style="padding-block:10px;font-size:12.5px;color:var(--ink-2)">
      Last 30 days: <strong>${fmtPct(a30.acceptRate)}</strong> acceptance · <strong>${fmtPct(a30.replyRate)}</strong> reply rate · <strong>${a30.k.meetings}</strong> meetings
    </div>
    <div class="foot">
      <button type="button" class="btn sm" onClick=${() => UI.go('prospects', { prospectFilter: Object.assign({}, UI.prospectFilter, { clientId: c.id, senderId: '', status: '' }) })}><${Icon} n="users" s=${14} />Prospects</button>
      <button type="button" class="btn sm" onClick=${() => UI.open('bulk', { clientId: c.id })}><${Icon} n="upload" s=${14} />Add prospects</button>
      <span style="flex:1"></span>
      <button type="button" class="btn sm" onClick=${() => UI.open('client', { id: c.id })}><${Icon} n="edit" s=${14} />Edit</button>
      <${Menu} icon="more" items=${[
        c.status === 'paused' ? { label: 'Resume client', icon: 'play', onSelect: () => setStatus('active') } : c.status !== 'archived' ? { label: 'Pause client', icon: 'pause', onSelect: () => setStatus('paused') } : null,
        c.status === 'archived' ? { label: 'Restore client', icon: 'undo', onSelect: () => setStatus('active') } : { label: 'Archive client', icon: 'inbox', onSelect: () => setStatus('archived') },
        { divider: true },
        { label: 'Delete client and prospects…', icon: 'trash', danger: true, onSelect: () => UI.open('confirm', {
          title: 'Delete ' + c.name + '?', danger: true, typed: 'DELETE', confirmLabel: 'Delete for good',
          body: 'This removes the client and all ' + plural(ps.length, 'prospect') + ' with their history. Archive instead if you might need the numbers later.',
          onConfirm: async () => {
            if (!W.guard()) return;
            await W.many(ps, p => W.del(prospectPath(p), true));
            await W.del('clients/' + c.id);
            UI.toast(c.name + ' deleted.');
          } }) },
      ]} />
    </div>
  </article>`;
}

function ClientsView() {
  const data = currentData();
  const [showArchived, setShowArchived] = useState(false);
  const usage = useMemo(() => senderUsage(data.prospects, TODAY), [data, TODAY]);
  const board = useMemo(() => buildBoard(data, { today: TODAY }), [data, TODAY]);
  const list = Object.values(data.clients).sort((a, b) => byText(a.name, b.name));
  const live = list.filter(c => c.status !== 'archived');
  const archived = list.filter(c => c.status === 'archived');
  const senders = live.reduce((n, c) => n + (c.senders || []).length, 0);
  return html`<div class="page">
    <header class="page-head">
      <div><p class="eyebrow">${plural(live.length, 'client')} · ${plural(senders, 'LinkedIn account')}</p><h1>Clients</h1>
        <p class="lede">Each client has one or more LinkedIn accounts you send from. Daily and weekly invite limits keep those accounts safe.</p></div>
      <div class="head-actions"><button type="button" class="btn primary" onClick=${() => UI.open('client', {})}><${Icon} n="plus" s=${14} />Add client</button></div>
    </header>
    ${live.length === 0 ? html`<div class="panel"><${Empty} icon="briefcase" title="No clients yet"
        action=${html`<button type="button" class="btn primary" onClick=${() => UI.open('client', {})}><${Icon} n="plus" s=${14} />Add client</button>`}>
        Add the companies you run outreach for, with the LinkedIn account (or accounts) you send from.</${Empty}></div>`
      : html`<div class="client-grid">${live.map(c => html`<${ClientCard} key=${c.id} c=${c} data=${data} usage=${usage} board=${board} />`)}</div>`}
    ${archived.length > 0 && html`<div class="stack">
      <button type="button" class="btn ghost" style="align-self:flex-start" onClick=${() => setShowArchived(!showArchived)}><${Icon} n=${showArchived ? 'chevDown' : 'chevRight'} s=${14} />${plural(archived.length, 'archived client')}</button>
      ${showArchived && html`<div class="client-grid">${archived.map(c => html`<${ClientCard} key=${c.id} c=${c} data=${data} usage=${usage} board=${board} />`)}</div>`}
    </div>`}
  </div>`;
}

function blankSender(name) { return Object.assign({ id: uid('sn'), name: name || '', url: '', ownerId: '' }, SENDER_DEFAULTS); }

function ClientModal({ id }) {
  const data = currentData();
  const existing = id ? data.clients[id] : null;
  const [v, setV] = useState(() => existing ? clone(existing) : {
    id: uid('cl'), name: '', colorIdx: Object.keys(data.clients).length % CLIENT_COLORS, status: 'active', ownerId: UI.me || '',
    defaultSequenceId: (Object.values(data.seqs).find(s => !s.archived) || {}).id || '', notes: '', senders: [blankSender('')],
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setV(Object.assign({}, v, { [k]: e.target.value }));
  const setSender = (i, k) => e => { const s = v.senders.slice(); s[i] = Object.assign({}, s[i], { [k]: e.target.value }); setV(Object.assign({}, v, { senders: s })); };
  const inUse = sid => data.prospects.filter(p => p.clientId === v.id && p.senderId === sid).length;
  const removeSender = i => { const s = v.senders.slice(); s.splice(i, 1); setV(Object.assign({}, v, { senders: s })); };
  const save = async e => {
    e.preventDefault();
    setErr('');
    const name = String(v.name || '').trim();
    if (!name) { setErr('Give the client a name.'); return; }
    const senders = (v.senders || []).map(s => Object.assign({}, s, {
      name: String(s.name || '').trim(), url: s.url ? ((normalizeLinkedIn(s.url) || {}).url || String(s.url).trim()) : '',
      dailyInvites: Math.max(0, parseInt(s.dailyInvites, 10) || 0), weeklyInvites: Math.max(0, parseInt(s.weeklyInvites, 10) || 0), dailyMessages: Math.max(0, parseInt(s.dailyMessages, 10) || 0),
    })).filter(s => s.name);
    if (!senders.length) { setErr('Add at least one LinkedIn account with a name, e.g. the founder you send as.'); return; }
    if (!W.guard()) return;
    setBusy(true);
    let seqId = v.defaultSequenceId;
    if (!seqId || !data.seqs[seqId]) { const s = await ensureDefaultSequence(); seqId = s ? s.id : ''; }
    const doc = Object.assign({}, v, { name, senders, defaultSequenceId: seqId, updatedAt: nowTs(), createdAt: v.createdAt || nowTs() });
    const ok = await W.saveClient(doc);
    setBusy(false);
    if (!ok) return;
    UI.close();
    UI.toast(existing ? 'Client saved.' : name + ' added. Next, add their prospects.', existing ? null : { undo: () => W.del('clients/' + doc.id) });
  };
  const over = s => (parseInt(s.dailyInvites, 10) || 0) > 30 || (parseInt(s.weeklyInvites, 10) || 0) > 150;
  return html`<${Modal} title=${existing ? 'Edit client' : 'Add a client'} size="wide"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button><button type="submit" form="client-form" class="btn primary" disabled=${busy}>${existing ? 'Save client' : 'Add client'}</button>`}>
    <form id="client-form" class="stack" onSubmit=${save}>
      <div class="fields">
        <label class="field"><span>Client name</span><input id="c-name" class="input" data-autofocus placeholder="Acme Analytics" value=${v.name} onInput=${set('name')} /></label>
        <label class="field"><span>Account manager</span><${MemberSelect} id="c-owner" settings=${data.settings} value=${v.ownerId} onChange=${x => setV(Object.assign({}, v, { ownerId: x }))} /></label>
        <label class="field"><span>Default sequence</span><${SequenceSelect} id="c-seq" data=${data} clientId=${v.id} value=${v.defaultSequenceId} allowEmpty=${Object.keys(data.seqs).length ? '' : 'Standard 4-step (created on save)'} onChange=${x => setV(Object.assign({}, v, { defaultSequenceId: x }))} /></label>
        <div class="field"><span>Color</span><div class="swatches">
          ${Array.from({ length: CLIENT_COLORS }, (_, i) => html`<button type="button" key=${i} class=${'swatch c' + i} style="background:var(--c${i}-fg)" aria-label=${'Color ' + (i + 1)} aria-pressed=${(v.colorIdx | 0) === i ? 'true' : 'false'} onClick=${() => setV(Object.assign({}, v, { colorIdx: i }))}></button>`)}
        </div></div>
        <label class="field full"><span>Notes <span class="hint">ICP, offer, booking link, tone of voice</span></span><textarea id="c-notes" class="textarea" style="min-height:64px" value=${v.notes} onInput=${set('notes')}></textarea></label>
      </div>
      <div class="stack">
        <div><span class="label">LinkedIn accounts you send from</span>
          <p class="muted" style="font-size:12.5px;margin-top:2px">Safe defaults: 20 invites a day and 100 a week per account. New or low-activity accounts should start lower.</p></div>
        ${v.senders.map((s, i) => html`<div class="sender-edit" key=${s.id}>
          <label class="field"><span>Name</span><input id=${'s-name-' + i} class="input sm" placeholder="Jane Founder" value=${s.name} onInput=${setSender(i, 'name')} /></label>
          <label class="field"><span>Profile URL</span><input id=${'s-url-' + i} class="input sm" placeholder="linkedin.com/in/…" value=${s.url} onInput=${setSender(i, 'url')} /></label>
          <label class="field"><span>Run by</span><${MemberSelect} id=${'s-owner-' + i} cls="select sm" settings=${data.settings} value=${s.ownerId} onChange=${x => setSender(i, 'ownerId')({ target: { value: x } })} /></label>
          <label class="field"><span>Invites/day</span><input id=${'s-d-' + i} class="input sm" type="number" min="0" value=${s.dailyInvites} onInput=${setSender(i, 'dailyInvites')} /></label>
          <label class="field"><span>Invites/week</span><input id=${'s-w-' + i} class="input sm" type="number" min="0" value=${s.weeklyInvites} onInput=${setSender(i, 'weeklyInvites')} /></label>
          <label class="field"><span>Msgs/day</span><input id=${'s-m-' + i} class="input sm" type="number" min="0" value=${s.dailyMessages} onInput=${setSender(i, 'dailyMessages')} /></label>
          <button type="button" class="btn sm ghost icon rm" aria-label="Remove account" disabled=${v.senders.length === 1 || inUse(s.id) > 0} title=${inUse(s.id) ? 'Prospects use this account. Move them first.' : 'Remove'} onClick=${() => removeSender(i)}><${Icon} n="trash" s=${14} /></button>
          ${over(s) && html`<span class="hint" style="grid-column:1/-1;color:var(--today)">That's above what most agencies consider safe for manual outreach.</span>`}
        </div>`)}
        <button type="button" class="btn sm" style="align-self:flex-start" onClick=${() => setV(Object.assign({}, v, { senders: v.senders.concat(blankSender('')) }))}><${Icon} n="plus" s=${14} />Add another account</button>
      </div>
      ${err && html`<div class="note-box bad">${err}</div>`}
    </form>
  <//>`;
}

/* ---------- sequences ---------- */
function CadenceRuler({ seq }) {
  const pts = cadence(seq);
  return html`<div class="ruler" aria-label="Cadence">
    <div class="ruler-track">
      ${pts.map(x => html`${x.gateBefore && html`<div class="ruler-node gate" key=${'g' + x.i}><span class="pt"></span><span class="day">accepted</span><span class="lbl muted" style="font-weight:500">waits here</span></div>`}
        <div class="ruler-node" key=${x.step.id}>
          <span class="pt"><${Icon} n=${(STEP_TYPES[x.step.type] || STEP_TYPES.task).icon} s=${11} /></span>
          <span class="day">Day ${x.day}${isClock(x.step.time) ? ' · ' + fmtClock(x.step.time) : ''}</span>
          <span class="lbl">${stepShort(seq, x.i)}${x.step.label ? html`<br /><span class="muted" style="font-weight:500">${x.step.label}</span>` : ''}</span>
        </div>`)}
    </div>
  </div>`;
}

function StepCard({ seq, i, onChange, onMove, onRemove, taRef, inUseCount }) {
  const s = seq.steps[i];
  const t = STEP_TYPES[s.type] || STEP_TYPES.task;
  const prev = seq.steps[i - 1];
  const afterConnect = prev && prev.type === 'connect';
  const set = (k, val) => onChange(Object.assign({}, s, { [k]: val }));
  const insertVar = name => {
    const el = taRef(s.id);
    const token = '{{' + name + '}}';
    const cur = s.template || '';
    if (el && typeof el.selectionStart === 'number') {
      const a = el.selectionStart, b = el.selectionEnd;
      set('template', cur.slice(0, a) + token + cur.slice(b));
      setTimeout(() => { try { el.focus(); el.selectionStart = el.selectionEnd = a + token.length; } catch (e) { /* ignore */ } }, 0);
    } else set('template', cur + token);
  };
  let delayText;
  if (i === 0) delayText = ['Send', 'days after the prospect is added (their start date)'];
  else if (afterConnect) delayText = ['Send', 'days after they accept'];
  else delayText = ['Wait', 'days after the previous step is done'];
  const hasText = s.type !== 'visit' && s.type !== 'follow';
  return html`<div class="step-card">
    <div class="sh">
      <span class="idx">${i + 1}</span>
      <select id=${'st-type-' + s.id} class="select sm" style="width:auto" value=${s.type} onChange=${e => set('type', e.target.value)} aria-label="Step type">
        ${STEP_TYPE_ORDER.map(k => html`<option key=${k} value=${k} selected=${s.type === k}>${STEP_TYPES[k].name}</option>`)}
      </select>
      <input id=${'st-label-' + s.id} class="input sm" style="flex:1 1 140px;width:auto" placeholder="Label (optional), e.g. Value" value=${s.label || ''} onInput=${e => set('label', e.target.value)} />
      <span class="btn-row" style="gap:4px">
        <button type="button" class="btn sm ghost icon" aria-label="Move up" disabled=${i === 0} onClick=${() => onMove(i, -1)}><${Icon} n="up" s=${14} /></button>
        <button type="button" class="btn sm ghost icon" aria-label="Move down" disabled=${i === seq.steps.length - 1} onClick=${() => onMove(i, 1)}><${Icon} n="down" s=${14} /></button>
        <button type="button" class="btn sm ghost icon" aria-label="Remove step" disabled=${seq.steps.length === 1} onClick=${() => onRemove(i)}><${Icon} n="trash" s=${14} /></button>
      </span>
    </div>
    <div class="sb">
      <div class="delay">
        <span>${delayText[0]}</span>
        <input id=${'st-delay-' + s.id} class="input sm num" type="number" min="0" max="365" value=${s.delayDays} onInput=${e => set('delayDays', Math.max(0, parseInt(e.target.value, 10) || 0))} aria-label="Days" />
        <span>${delayText[1]}</span>
        <span class="muted">·</span>
        <label class="delay-time"><span>at</span><input id=${'st-time-' + s.id} class="input sm" type="time" value=${s.time || ''} onInput=${e => set('time', e.target.value)} aria-label="Send time (optional)" /></label>
        ${s.time ? html`<button type="button" class="btn sm ghost" onClick=${() => set('time', '')}>Any time</button>` : html`<span class="muted" style="font-size:12px">any time of day</span>`}
        ${inUseCount > 0 && html`<span class="pill tone-info">${plural(inUseCount, 'person', 'people')} waiting here</span>`}
      </div>
      ${hasText && html`<label class="field"><span>${t.text}</span>
        <textarea id=${'st-tpl-' + s.id} ref=${el => taRef(s.id, el)} class="textarea" style=${s.type === 'connect' ? 'min-height:72px' : ''} value=${s.template || ''} onInput=${e => set('template', e.target.value)}></textarea></label>
      <div class="btn-row" style="justify-content:space-between">
        <div class="var-chips" aria-label="Insert variable">${TEMPLATE_VARS.map(([k]) => html`<button type="button" key=${k} onClick=${() => insertVar(k)}>{{${k}}}</button>`)}</div>
        <${Chars} text=${s.template} connect=${s.type === 'connect'} />
      </div>`}
    </div>
  </div>`;
}

function seqSignature(s) {
  return JSON.stringify([s.name || '', s.description || '', s.clientId || null,
    (s.steps || []).map(x => [x.id, x.type, x.label || '', parseInt(x.delayDays, 10) || 0, x.template || ''])]);
}
function SequenceEditor({ seq, data }) {
  const [d, setD] = useState(() => clone(seq));
  const [base, setBase] = useState(() => seqSignature(seq));
  const refs = useRef({});
  const dirty = seqSignature(d) !== base;
  useEffect(() => {
    const sig = seqSignature(seq);
    if (sig === base) return;
    if (!dirty) { setD(clone(seq)); setBase(sig); }
  }, [seq.updatedAt]);
  const taRef = (id, el) => { if (el !== undefined) refs.current[id] = el; return refs.current[id]; };
  const users = data.prospects.filter(p => p.sequenceId === seq.id);
  const openUsers = users.filter(p => ['queued', 'active', 'invited'].indexOf(p.status) !== -1);
  const waitingAt = sid => openUsers.filter(p => p.stepId === sid).length;
  const issues = validateSequence(d);
  const bad = issues.some(x => x.level === 'bad');
  const setStep = i => st => { const steps = d.steps.slice(); steps[i] = st; setD(Object.assign({}, d, { steps })); };
  const move = (i, dir) => { const steps = d.steps.slice(); const j = i + dir; if (j < 0 || j >= steps.length) return; const t = steps[i]; steps[i] = steps[j]; steps[j] = t; setD(Object.assign({}, d, { steps })); };
  const remove = i => { const steps = d.steps.slice(); steps.splice(i, 1); setD(Object.assign({}, d, { steps })); };
  const add = type => setD(Object.assign({}, d, { steps: d.steps.concat({ id: uid('st'), type, label: '', delayDays: type === 'connect' ? 0 : 3, template: type === 'message' ? 'Hi {{firstName}}, ' : '' }) }));
  const save = async () => {
    if (bad || !W.guard()) return;
    const doc = Object.assign({}, d, { name: String(d.name || '').trim(), updatedAt: nowTs() });
    if (await W.saveSequence(doc)) {
      setD(clone(doc)); setBase(seqSignature(doc));
      UI.toast('Sequence saved. ' + (openUsers.length ? plural(openUsers.length, 'prospect') + ' pick up the change on their next step.' : ''));
    }
  };
  const duplicate = async () => {
    if (!W.guard()) return;
    const copy = Object.assign(clone(d), { id: uid('seq'), name: d.name + ' (copy)', createdAt: nowTs(), updatedAt: nowTs(), archived: false });
    copy.steps = copy.steps.map(s => Object.assign({}, s, { id: uid('st') }));
    if (await W.saveSequence(copy)) { UI.set({ seqSelected: copy.id }); UI.toast('Copied. You are editing the copy.'); }
  };
  const toggleArchive = async () => {
    if (!W.guard()) return;
    if (await W.saveSequence(Object.assign({}, seq, { archived: !seq.archived, updatedAt: nowTs() }))) UI.toast(seq.archived ? 'Sequence restored.' : 'Sequence archived. People already in it keep going.');
  };
  const del = () => UI.open('confirm', { title: 'Delete ' + seq.name + '?', danger: true, confirmLabel: 'Delete', body: 'Nobody uses this sequence, so it is safe to delete.', onConfirm: async () => { if (await W.deleteSequence(seq)) { UI.set({ seqSelected: null }); UI.toast('Sequence deleted.'); } } });
  return html`<div class="stack-lg">
    <div class="panel panel-pad stack">
      <div class="fields">
        <label class="field"><span>Name</span><input id="seq-name" class="input" value=${d.name} onInput=${e => setD(Object.assign({}, d, { name: e.target.value }))} /></label>
        <label class="field"><span>Available to</span><select id="seq-scope" class="select" value=${d.clientId || ''} onChange=${e => setD(Object.assign({}, d, { clientId: e.target.value || null }))}>
          <option value="" selected=${!d.clientId}>All clients</option>
          ${Object.values(data.clients).sort((a, b) => byText(a.name, b.name)).map(c => html`<option key=${c.id} value=${c.id} selected=${d.clientId === c.id}>Only ${c.name}</option>`)}
        </select></label>
        <label class="field full"><span>Description</span><input id="seq-desc" class="input" placeholder="When to use this sequence" value=${d.description || ''} onInput=${e => setD(Object.assign({}, d, { description: e.target.value }))} /></label>
      </div>
      <div><span class="label">Cadence</span><${CadenceRuler} seq=${d} /></div>
      <p class="muted" style="font-size:12.5px">${plural(users.length, 'prospect')} use this sequence, ${openUsers.length} still in progress. Changes apply to their upcoming steps; finished steps keep their history. Due dates on non-working days move to the next working day.</p>
    </div>
    ${issues.length > 0 && html`<div class="stack">${issues.map((x, i) => html`<div key=${i} class=${'note-box ' + (x.level === 'bad' ? 'bad' : 'warn')}>${x.text}</div>`)}</div>`}
    <div class="stack">
      ${d.steps.map((s, i) => html`<${StepCard} key=${s.id} seq=${d} i=${i} onChange=${setStep(i)} onMove=${move} onRemove=${remove} taRef=${taRef} inUseCount=${waitingAt(s.id)} />`)}
      <div class="btn-row">
        <button type="button" class="btn sm" onClick=${() => add('message')}><${Icon} n="plus" s=${14} />Add message</button>
        <${Menu} label="Add other step" btnClass="btn sm" items=${STEP_TYPE_ORDER.filter(k => k !== 'message').map(k => ({ label: STEP_TYPES[k].name, icon: STEP_TYPES[k].icon, onSelect: () => add(k), disabled: k === 'connect' && d.steps.some(s => s.type === 'connect') }))} />
      </div>
    </div>
    <div class="panel panel-pad btn-row" style="position:sticky;bottom:calc(env(safe-area-inset-bottom, 0px) + 12px);z-index:4;box-shadow:var(--shadow-2)">
      <button type="button" class="btn primary" disabled=${!dirty || bad} onClick=${save}><${Icon} n="check" s=${14} />Save sequence</button>
      ${dirty && html`<button type="button" class="btn ghost" onClick=${() => { setD(clone(seq)); setBase(seqSignature(seq)); }}>Discard changes</button>`}
      <span style="flex:1"></span>
      ${seq.clientId && data.clients[seq.clientId] && data.clients[seq.clientId].defaultSequenceId !== seq.id && html`<button type="button" class="btn sm" onClick=${() => W.guard() && W.saveClient(Object.assign(clone(data.clients[seq.clientId]), { defaultSequenceId: seq.id, updatedAt: nowTs() })).then(ok => ok && UI.toast('Now the default for ' + data.clients[seq.clientId].name + '.'))}>Make ${data.clients[seq.clientId].name}'s default</button>`}
      <button type="button" class="btn sm" onClick=${duplicate}><${Icon} n="copy" s=${14} />Duplicate</button>
      ${users.length ? html`<button type="button" class="btn sm" onClick=${toggleArchive}>${seq.archived ? 'Restore' : 'Archive'}</button>`
        : html`<button type="button" class="btn sm danger" onClick=${del}><${Icon} n="trash" s=${14} />Delete</button>`}
    </div>
  </div>`;
}

const SEQ_PRESETS = [['standard', 'Standard 4-step (3 / 5 / 7 days)'], ['warmup', 'Warm-up first (visit, engage, invite)'], ['short', 'Short: 2 messages'], ['blank', 'Blank']];

function NewSequenceModal({ clientId }) {
  const data = currentData();
  const [cid, setCid] = useState(clientId || '');
  const [from, setFrom] = useState('preset:standard');
  const [name, setName] = useState('');
  const [makeDefault, setMakeDefault] = useState(!!clientId);
  const [busy, setBusy] = useState(false);
  const existing = Object.values(data.seqs).filter(s => !s.archived).sort((a, b) => byText(a.name, b.name));
  const client = data.clients[cid];
  const suggested = () => {
    if (from.indexOf('copy:') === 0) { const src = data.seqs[from.slice(5)]; return (src ? src.name : 'Sequence') + (client ? ' · ' + client.name : ' (copy)'); }
    const pr = SEQUENCE_PRESETS[from.slice(7)] || SEQUENCE_PRESETS.blank;
    return (client ? client.name + ' · ' : '') + pr.name;
  };
  const create = async () => {
    if (!W.guard()) return;
    setBusy(true);
    let seq;
    if (from.indexOf('copy:') === 0) {
      const src = data.seqs[from.slice(5)];
      seq = Object.assign(clone(src), { id: uid('seq'), archived: false, createdAt: nowTs(), updatedAt: nowTs() });
      seq.steps = seq.steps.map(st => Object.assign({}, st, { id: uid('st') }));
    } else seq = makeSequence(from.slice(7));
    seq.name = name.trim() || suggested();
    seq.clientId = cid || null;
    const ok = await W.saveSequence(seq);
    if (ok && cid && makeDefault && client) await W.saveClient(Object.assign(clone(client), { defaultSequenceId: seq.id, updatedAt: nowTs() }));
    setBusy(false);
    if (!ok) return;
    UI.close();
    UI.go('sequences', { seqSelected: seq.id });
    UI.toast(seq.name + ' created. Edit its messages, delays and send times below.');
  };
  return html`<${Modal} title="New sequence" sub="Build one per client so each client's cadence and messaging stay their own." size="narrow"
    foot=${html`<button type="button" class="btn" onClick=${() => UI.close()}>Cancel</button><button type="button" class="btn primary" disabled=${busy} onClick=${create}>Create sequence</button>`}>
    <label class="field"><span>For</span><select id="ns-client" class="select" value=${cid} onChange=${e => { setCid(e.target.value); setMakeDefault(!!e.target.value); }}>
      <option value="" selected=${!cid}>All clients (shared template)</option>
      ${Object.values(data.clients).filter(c => c.status !== 'archived').sort((a, b) => byText(a.name, b.name)).map(c => html`<option key=${c.id} value=${c.id} selected=${cid === c.id}>${c.name} only</option>`)}
    </select></label>
    <label class="field"><span>Start from</span><select id="ns-from" class="select" value=${from} onChange=${e => setFrom(e.target.value)}>
      <optgroup label="Templates">${SEQ_PRESETS.map(([k, l]) => html`<option key=${k} value=${'preset:' + k} selected=${from === 'preset:' + k}>${l}</option>`)}</optgroup>
      ${existing.length > 0 && html`<optgroup label="Copy an existing sequence">${existing.map(x => html`<option key=${x.id} value=${'copy:' + x.id} selected=${from === 'copy:' + x.id}>${x.name}</option>`)}</optgroup>`}
    </select></label>
    <label class="field"><span>Name</span><input id="ns-name" class="input" data-autofocus placeholder=${suggested()} value=${name} onInput=${e => setName(e.target.value)} /></label>
    ${cid && html`<label class="check"><input id="ns-default" type="checkbox" checked=${makeDefault} onChange=${e => setMakeDefault(e.target.checked)} />Make it ${client ? client.name + "'s" : 'the client'} default for new prospects</label>`}
  <//>`;
}

function SequencesView() {
  const data = currentData();
  const [scope, setScope] = useState(UI.seqScope || '');
  const all = Object.values(data.seqs).sort((a, b) => (a.archived === b.archived ? byText(a.name, b.name) : a.archived ? 1 : -1));
  const list = all.filter(s => !scope || (scope === '_shared' ? !s.clientId : s.clientId === scope));
  const counts = {};
  data.prospects.forEach(p => { if (['queued', 'active', 'invited'].indexOf(p.status) !== -1) counts[p.sequenceId] = (counts[p.sequenceId] || 0) + 1; });
  const mostUsed = list.filter(s => !s.archived).slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))[0];
  const sel = (data.seqs[UI.seqSelected] && list.some(x => x.id === UI.seqSelected) ? data.seqs[UI.seqSelected] : null) || mostUsed || list[0];
  const groups = [];
  const shared = list.filter(s => !s.clientId);
  if (shared.length) groups.push({ key: '_shared', title: 'Shared templates', items: shared });
  Object.values(data.clients).sort((a, b) => byText(a.name, b.name)).forEach(c => {
    const items = list.filter(s => s.clientId === c.id);
    if (items.length) groups.push({ key: c.id, title: c.name, client: c, items });
  });
  const orphan = list.filter(s => s.clientId && !data.clients[s.clientId]);
  if (orphan.length) groups.push({ key: '_orphan', title: 'Deleted clients', items: orphan });
  const setScopeP = v => { setScope(v); UI.seqScope = v; };
  const clientsWithout = Object.values(data.clients).filter(c => c.status !== 'archived' && !all.some(s => s.clientId === c.id));
  return html`<div class="page">
    <header class="page-head">
      <div><p class="eyebrow">${plural(all.filter(s => !s.archived).length, 'sequence')} · ${plural(all.filter(s => s.clientId && !s.archived).length, 'client-specific')}</p><h1>Sequences</h1>
        <p class="lede">Give every client its own cadence and messages, or share a template. Delays count from when the previous step was actually done; send times put each step on a clock.</p></div>
      <div class="head-actions"><button type="button" class="btn primary" onClick=${() => UI.open('newSeq', { clientId: scope && scope[0] !== '_' ? scope : '' })}><${Icon} n="plus" s=${14} />New sequence</button></div>
    </header>
    <div class="toolbar">
      <select id="seq-scope-filter" class="select sm" value=${scope} onChange=${e => setScopeP(e.target.value)} aria-label="Show sequences for">
        <option value="" selected=${!scope}>All sequences</option>
        <option value="_shared" selected=${scope === '_shared'}>Shared templates</option>
        ${Object.values(data.clients).sort((a, b) => byText(a.name, b.name)).map(c => html`<option key=${c.id} value=${c.id} selected=${scope === c.id}>${c.name}</option>`)}
      </select>
      ${clientsWithout.length > 0 && html`<span class="muted" style="font-size:12.5px">${clientsWithout.map(c => c.name).join(', ')} ${clientsWithout.length === 1 ? 'uses' : 'use'} shared templates.
        <button type="button" class="btn sm ghost" onClick=${() => UI.open('newSeq', { clientId: clientsWithout[0].id })}>Create one for ${clientsWithout[0].name}</button></span>`}
    </div>
    ${!all.length ? html`<div class="panel"><${Empty} icon="route" title="No sequences yet"
        action=${html`<button type="button" class="btn primary" onClick=${() => UI.open('newSeq', {})}><${Icon} n="plus" s=${14} />Create a sequence</button>`}>
        Start with the standard cadence: invite, then messages on acceptance, +3, +5 and +7 days.</${Empty}></div>`
    : !list.length ? html`<div class="panel"><${Empty} icon="route" title="Nothing here yet"
        action=${html`<button type="button" class="btn primary" onClick=${() => UI.open('newSeq', { clientId: scope[0] === '_' ? '' : scope })}><${Icon} n="plus" s=${14} />New sequence</button>`}>
        ${scope && scope[0] !== '_' ? 'This client has no sequence of its own yet. It can still use shared templates.' : 'No sequences match.'}</${Empty}></div>`
    : html`<div class="seq-layout">
      <nav class="panel seq-list" aria-label="Sequences">
        ${groups.map(g => html`<div key=${g.key}>
          <div class="seq-group">${g.client ? html`<${ClientChip} client=${g.client} />` : g.title}
            ${g.client && html`<button type="button" class="btn sm ghost icon" title=${'New sequence for ' + g.client.name} aria-label=${'New sequence for ' + g.client.name} onClick=${() => UI.open('newSeq', { clientId: g.client.id })}><${Icon} n="plus" s=${13} /></button>`}</div>
          ${g.items.map(s => html`<button type="button" key=${s.id} class="seq-item" aria-current=${sel && sel.id === s.id ? 'true' : 'false'} onClick=${() => UI.set({ seqSelected: s.id })}>
            <span class="n">${s.name}${g.client && g.client.defaultSequenceId === s.id ? html` <span class="pill tone-accent" style="height:18px">default</span>` : ''}</span>
            <span class="m">${plural(s.steps.length, 'step')} · ${counts[s.id] || 0} in progress${s.archived ? ' · archived' : ''}</span>
          </button>`)}
        </div>`)}
      </nav>
      ${sel && html`<${SequenceEditor} key=${sel.id} seq=${sel} data=${data} />`}
    </div>`}
  </div>`;
}

/* ---------- settings ---------- */
function backupJSON(data) {
  return JSON.stringify({
    app: 'fastex-outreach-desk', version: 1, exportedAt: nowTs(),
    settings: data.settings, clients: Object.values(data.clients), sequences: Object.values(data.seqs), prospects: data.prospects,
  }, null, 1);
}
async function restoreBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { UI.toast('That file is not a valid backup.', { bad: true }); return; }
  if (!obj || obj.app !== 'fastex-outreach-desk' || !Array.isArray(obj.clients)) { UI.toast('That file is not an Outreach Desk backup.', { bad: true }); return; }
  if (!W.guard()) return;
  const items = [];
  if (obj.settings) items.push(['meta/settings', obj.settings]);
  (obj.sequences || []).forEach(s => s && s.id && items.push(['sequences/' + s.id, s]));
  (obj.clients || []).forEach(c => c && c.id && items.push(['clients/' + c.id, c]));
  (obj.prospects || []).forEach(p => p && p.id && p.clientId && items.push([prospectPath(p), p]));
  UI.toast('Restoring ' + plural(items.length, 'record') + '…');
  const res = await W.many(items, it => W.put(it[0], it[1], true));
  UI.toast(res.failed ? res.failed + ' records failed to restore.' : 'Backup restored: ' + plural(items.length, 'record') + '.', res.failed ? { bad: true } : null);
}

function SettingsView() {
  const data = currentData();
  const s = data.settings;
  const [agency, setAgency] = useState(s.agencyName || '');
  const [newMember, setNewMember] = useState('');
  useEffect(() => { setAgency(s.agencyName || ''); }, [s.agencyName]);
  const save = patch => W.guard() && W.saveSettings(patch).then(ok => ok && UI.toast('Settings saved.'));
  const addMember = e => {
    e.preventDefault();
    const name = newMember.trim();
    if (!name) return;
    const m = { id: uid('m'), name };
    save({ team: (s.team || []).concat(m) });
    setNewMember('');
    if (!UI.me) { UI.me = m.id; pref('me', m.id); }
  };
  const renameMember = (id, name) => save({ team: s.team.map(m => (m.id === id ? Object.assign({}, m, { name }) : m)) });
  const removeMember = id => save({ team: s.team.filter(m => m.id !== id) });
  const toggleDay = d => { const set = new Set(s.workDays || []); if (set.has(d)) set.delete(d); else set.add(d); save({ workDays: Array.from(set).sort() }); };
  const docCount = 1 + Object.keys(data.clients).length + Object.keys(data.seqs).length + data.prospects.length;
  const onRestore = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; restoreBackup(await readFileText(f)); e.target.value = ''; };
  const storage = Store.demoOn ? 'Sample data in this tab only. Nothing here is saved.'
    : Store.mode === 'cloud' ? 'Saved in this page\'s shared storage. Everyone you share it with (with edit access) sees the same data, live.'
    : 'Saved in this browser only. Export a backup regularly, or open the published page to share with your team.';
  return html`<div class="page">
    <header class="page-head"><div><p class="eyebrow">${s.agencyName || 'Workspace'}</p><h1>Settings</h1></div></header>
    <div class="settings-grid">
      <div class="stack-lg">
        <section class="panel">
          <div class="panel-head"><h3>Workspace</h3></div>
          <div class="panel-pad stack">
            <label class="field"><span>Agency name</span>
              <div class="team-row"><input id="set-agency" class="input" value=${agency} onInput=${e => setAgency(e.target.value)} />
                <button type="button" class="btn" disabled=${agency.trim() === (s.agencyName || '')} onClick=${() => save({ agencyName: agency.trim() })}>Save</button></div></label>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Team</h3><span class="muted" style="font-size:12.5px">Assign clients and LinkedIn accounts to people</span></div>
          <div class="panel-pad stack">
            ${(s.team || []).map(m => html`<div class="team-row" key=${m.id}>
              <input id=${'tm-' + m.id} class="input" value=${m.name} onBlur=${e => { const n = e.target.value.trim(); if (n && n !== m.name) renameMember(m.id, n); }} aria-label="Team member name" />
              <button type="button" class="btn ghost icon" aria-label=${'Remove ' + m.name} onClick=${() => removeMember(m.id)}><${Icon} n="trash" s=${14} /></button>
            </div>`)}
            <form class="team-row" onSubmit=${addMember}><input id="tm-new" class="input" placeholder="Add a teammate's name" value=${newMember} onInput=${e => setNewMember(e.target.value)} /><button type="submit" class="btn" disabled=${!newMember.trim()}>Add</button></form>
            <label class="field"><span>On this device, I am</span>
              <${MemberSelect} id="set-me" settings=${s} value=${UI.me} noneLabel="Not set" onChange=${x => { pref('me', x || null); UI.set({ me: x }); }} />
              <span class="hint">Signs the activity you log, and lets you filter Today to your accounts.</span></label>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Schedule</h3></div>
          <div class="panel-pad stack">
            <div class="field"><span>Working days <span class="hint">due dates on other days move to the next working day</span></span>
              <div class="day-toggles">${[1, 2, 3, 4, 5, 6, 0].map(d => html`<button type="button" key=${d} aria-pressed=${(s.workDays || []).indexOf(d) !== -1 ? 'true' : 'false'} onClick=${() => toggleDay(d)}>${WEEKDAYS[d]}</button>`)}</div></div>
            <div class="fields">
              <label class="field"><span>Flag invites pending after</span>
                <select id="set-stale" class="select" value=${String(s.staleDays)} onChange=${e => save({ staleDays: parseInt(e.target.value, 10) })}>
                  ${[14, 21, 28, 30, 45].map(n => html`<option key=${n} value=${String(n)} selected=${s.staleDays === n}>${n} days</option>`)}
                </select></label>
              <label class="field"><span>Daily run starts at</span>
                <input id="set-time" type="time" class="input" value=${s.reminderTime || '09:30'} onChange=${e => save({ reminderTime: e.target.value })} /></label>
            </div>
            <a class="btn" style="align-self:flex-start" href=${gcalRoutineLink(s)} target="_blank" rel="noopener noreferrer"><${Icon} n="calendar" s=${14} />Add weekday reminder to Google Calendar</a>
          </div>
        </section>
      </div>
      <div class="stack-lg">
        <section class="panel">
          <div class="panel-head"><h3>Data</h3><span class="mono muted">${fmtNum(docCount)} records</span></div>
          <div class="panel-pad stack">
            <p class="soft" style="font-size:13px">${storage}</p>
            <div class="btn-row">
              <button type="button" class="btn" onClick=${() => saveFile('outreach-backup-' + TODAY + '.json', backupJSON(data))}><${Icon} n="download" s=${14} />Export backup (JSON)</button>
              <button type="button" class="btn" disabled=${!data.prospects.length} onClick=${() => saveFile('prospects-' + TODAY + '.csv', prospectsCSV(data.prospects.map(p => ({ p, next: nextAction(p, data, TODAY) })), data))}><${Icon} n="download" s=${14} />Export prospects (CSV)</button>
            </div>
            <label class="field"><span>Restore a backup <span class="hint">adds or overwrites records with the same id</span></span>
              <input id="set-restore" type="file" accept=".json,application/json" class="input" onChange=${onRestore} /></label>
            ${Store.mode === 'cloud' && html`<p class="muted" style="font-size:12.5px">Shared storage holds up to about 25,000 records.</p>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Sample data</h3></div>
          <div class="panel-pad stack">
            <p class="soft" style="font-size:13px">Explore a filled-in workspace with three example clients. It runs in this tab only and never touches your data.</p>
            <div class="btn-row">
              ${Store.demoOn ? html`<button type="button" class="btn" onClick=${() => exitDemo(true)}>Close sample data</button>`
                : html`<button type="button" class="btn" onClick=${() => { enterDemo(false); UI.go('today'); }}>Open sample data</button>`}
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>LinkedIn safety guide</h3></div>
          <div class="panel-pad">
            <ul class="tips">
              <li>Keep each account to about 15–25 invites a day and roughly 100 a week. New accounts should start at 5–10 a day.</li>
              <li>Withdraw invites that are still pending after three weeks. A long pending list hurts the account.</li>
              <li>Connection notes max out at 300 characters (200 on free accounts). A blank note often gets accepted just as well.</li>
              <li>No pitch in the invite or the first message. Earn the reply first.</li>
              <li>Vary the first line of each client's templates so accounts don't send identical copy.</li>
              <li>Do the work by hand, at human speed. This desk never sends anything for you.</li>
            </ul>
          </div>
        </section>
        ${!Store.demoOn && html`<section class="panel">
          <div class="panel-head"><h3>Danger zone</h3></div>
          <div class="panel-pad stack">
            <p class="soft" style="font-size:13px">Delete every client, sequence and prospect in this workspace. Export a backup first.</p>
            <button type="button" class="btn danger" style="align-self:flex-start" onClick=${() => UI.open('confirm', {
              title: 'Delete all data?', danger: true, typed: 'DELETE', confirmLabel: 'Delete everything',
              body: 'This removes ' + plural(docCount, 'record') + ' for everyone who uses this workspace. It cannot be undone.',
              onConfirm: async () => {
                if (!W.guard()) return;
                const paths = data.prospects.map(prospectPath).concat(Object.keys(data.clients).map(id => 'clients/' + id), Object.keys(data.seqs).map(id => 'sequences/' + id), ['meta/settings']);
                const res = await W.many(paths, pth => W.del(pth, true));
                UI.toast(res.failed ? res.failed + ' records could not be deleted.' : 'All data deleted.', res.failed ? { bad: true } : null);
              } })}><${Icon} n="trash" s=${14} />Delete all data</button>
          </div>
        </section>`}
      </div>
    </div>
  </div>`;
}
