/* Fastex Outreach Desk — sample.js
   Builds an in-memory sample workspace (never written to shared storage).
   Every record is produced by the real engine, so the sample behaves like live data. */
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildSampleDocs(T) {
  const rnd = mulberry32(20260930);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const D = n => addDays(T, n);
  const docs = {};
  const team = [{ id: 'm_demo_priya', name: 'Priya' }, { id: 'm_demo_arjun', name: 'Arjun' }];
  const settings = Object.assign({}, DEFAULT_SETTINGS, { agencyName: 'Fastex', team });
  /* Opened on a weekend? Let the sample work every day so the Today list isn't empty. */
  if (weekdayOf(T) === 0 || weekdayOf(T) === 6) settings.workDays = [0, 1, 2, 3, 4, 5, 6];
  docs['meta/settings'] = settings;

  const std = makeSequence('standard', { id: 'seq_demo_standard' });
  const warm = makeSequence('warmup', { id: 'seq_demo_warmup' });
  const short = makeSequence('short', { id: 'seq_demo_short' });
  const nwSeq = makeSequence('standard', { id: 'seq_demo_northwind', name: 'Northwind · Data leaders', clientId: 'cl_demo_northwind' });
  ['09:30', '10:00', '11:00', '10:30', '16:00'].forEach((t, i) => { nwSeq.steps[i].time = t; });
  nwSeq.steps[1].template = 'Thanks for connecting, {{firstName}}! I work with data teams at SaaS companies like {{company}}. Curious: how much of your week goes into pipeline reporting right now?';
  [std, warm, short, nwSeq].forEach(s => { docs['sequences/' + s.id] = s; });
  const seqs = { [std.id]: std, [warm.id]: warm, [short.id]: short, [nwSeq.id]: nwSeq };

  const clients = [
    {
      id: 'cl_demo_northwind', name: 'Northwind Analytics', colorIdx: 1, status: 'active', ownerId: 'm_demo_priya', defaultSequenceId: nwSeq.id,
      lists: [{ id: 'ls_demo_data', name: 'Heads of Data' }, { id: 'ls_demo_revops', name: 'RevOps leaders' }],
      notes: 'ICP: Heads of Data and RevOps at 50–500 person SaaS companies. Offer: free 14-day pipeline audit.',
      senders: [{ id: 'sn_demo_maya', name: 'Maya Chen', url: 'https://www.linkedin.com/in/example-maya-chen/', ownerId: 'm_demo_priya', dailyInvites: 12, weeklyInvites: 80, dailyMessages: 50 }],
    },
    {
      id: 'cl_demo_brightline', name: 'Brightline Logistics', colorIdx: 4, status: 'active', ownerId: 'm_demo_arjun', defaultSequenceId: std.id,
      lists: [{ id: 'ls_demo_d2c', name: 'D2C brands' }, { id: 'ls_demo_event', name: 'ShipCon attendees', sequenceId: short.id }],
      notes: 'ICP: Ops and supply chain directors at D2C brands. Offer: same-week warehouse onboarding.',
      senders: [{ id: 'sn_demo_omar', name: 'Omar Haddad', url: 'https://www.linkedin.com/in/example-omar-haddad/', ownerId: 'm_demo_arjun', dailyInvites: 20, weeklyInvites: 100, dailyMessages: 50 }],
    },
    {
      id: 'cl_demo_cedar', name: 'Cedar & Stone Studio', colorIdx: 0, status: 'active', ownerId: 'm_demo_priya', defaultSequenceId: warm.id,
      notes: 'ICP: Founders and heads of workplace at growing companies moving offices. Offer: office fit-out consultation.',
      senders: [
        { id: 'sn_demo_elena', name: 'Elena Rossi', url: 'https://www.linkedin.com/in/example-elena-rossi/', ownerId: 'm_demo_priya', dailyInvites: 15, weeklyInvites: 80, dailyMessages: 40 },
        { id: 'sn_demo_luca', name: 'Luca Bianchi', url: 'https://www.linkedin.com/in/example-luca-bianchi/', ownerId: 'm_demo_arjun', dailyInvites: 15, weeklyInvites: 80, dailyMessages: 40 },
      ],
    },
  ];
  clients.forEach(c => { docs['clients/' + c.id] = Object.assign({ createdAt: nowTs(), updatedAt: nowTs() }, c); });

  const FIRST = ['Aisha', 'Ben', 'Carla', 'Dmitri', 'Elif', 'Farah', 'Gustavo', 'Hana', 'Ivan', 'Jonas', 'Keiko', 'Leila', 'Marcus', 'Nadia', 'Oscar', 'Priyanka', 'Quinn', 'Rafael', 'Sofia', 'Tariq', 'Uma', 'Victor', 'Wen', 'Yusuf', 'Zara', 'Anika', 'Bruno', 'Chloe', 'Daniel', 'Esther', 'Felix', 'Grace', 'Hugo', 'Imani', 'Julia', 'Kofi', 'Lena', 'Mateo', 'Noor', 'Olivia'];
  const LAST = ['Adeyemi', 'Brandt', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Gallagher', 'Hosseini', 'Iyer', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quintero', 'Rahman', 'Sato', 'Tan', 'Varga', 'Walsh', 'Yilmaz', 'Zimmermann', 'Mehta', 'Novak', 'Oliveira', 'Park'];
  const COMPANIES = {
    cl_demo_northwind: ['Quillstone', 'Harbor Metrics', 'Loopwise', 'Tallyfield', 'Brisk CRM', 'Veridian Labs', 'Signalpath', 'Northpeak Cloud', 'Relayboard', 'Cobalt Ledger'],
    cl_demo_brightline: ['Kindred Goods', 'Oat & Arrow', 'Parcel Theory', 'Bloomsmith', 'Fernway Home', 'Sundry Supply', 'Maple Mercantile', 'Tidewater Brands'],
    cl_demo_cedar: ['Lumen Health', 'Foundry Nine', 'Atlas Robotics', 'Greenbar Foods', 'Mosaic Learning', 'Halcyon Legal', 'Brightwater Media', 'Keystone Bio'],
  };
  const TITLES = {
    cl_demo_northwind: ['Head of Data', 'VP Revenue Operations', 'Director of Analytics', 'RevOps Lead', 'Chief Operating Officer', 'Head of Growth'],
    cl_demo_brightline: ['Director of Operations', 'Head of Supply Chain', 'Ops Manager', 'COO', 'Founder', 'VP Fulfilment'],
    cl_demo_cedar: ['Founder & CEO', 'Head of Workplace', 'People & Places Lead', 'COO', 'Office Manager', 'VP People'],
  };
  const CITIES = ['London', 'Berlin', 'Amsterdam', 'Dubai', 'Bengaluru', 'Toronto', 'Austin', 'Singapore', 'Mumbai', 'Stockholm'];
  const usedNames = new Set();
  let serial = 0;

  function person(cid) {
    let f, l;
    do { f = pick(FIRST); l = pick(LAST); } while (usedNames.has(f + l));
    usedNames.add(f + l);
    serial++;
    const cl = (clients.find(c => c.id === cid) || {}).lists || [];
    return {
      listId: cl.length && rnd() < 0.8 ? pick(cl).id : null,
      firstName: f, lastName: l, company: pick(COMPANIES[cid]), title: pick(TITLES[cid]), location: pick(CITIES),
      norm: normalizeLinkedIn('https://www.linkedin.com/in/example-' + f.toLowerCase() + '-' + l.toLowerCase() + '-demo' + serial),
    };
  }
  function by(c) { return c.ownerId; }
  function stampLog(p) {
    const nowH = new Date().getHours();
    p.log = (p.log || []).map(e => {
      const maxH = e.on === T ? Math.max(0, Math.min(16, nowH - 1)) : 16;
      const h = Math.min(maxH, 9 + Math.floor(rnd() * 8));
      return Object.assign({}, e, { ts: new Date(dateOf(e.on).setHours(h, Math.floor(rnd() * 60), 0, 0)).toISOString() });
    });
    return p;
  }
  function save(p) { const path = 'clients/' + p.clientId + '/prospects/' + p.id; const q = stampLog(p); delete q.id; docs[path] = q; }

  /* Scripted people so every kind of task shows up on the Today list. */
  function scripted(c, senderIdx, seqId, startOffset, events, extra) {
    const seq = seqs[seqId];
    const person0 = person(c.id);
    const sender = c.senders[senderIdx] || c.senders[0];
    let p = newProspect(Object.assign({ clientId: c.id, senderId: sender.id, startOn: D(startOffset) }, person0, extra || {}),
      { seq, today: D(startOffset), by: by(c), source: 'Sample data' });
    p.addedOn = D(startOffset);
    p.log[0].on = D(startOffset);
    for (const ev of events) {
      const on = D(ev[1]);
      const who = by(c);
      if (ev[0] === 'step') p = actCompleteStep(p, seq, on, who);
      else if (ev[0] === 'accept') p = actAccept(p, seq, on, who);
      else if (ev[0] === 'reply') p = actReply(p, seq, on, who, ev[2]);
      else if (ev[0] === 'status') p = actSetStatus(p, seq, ev[2], on, who, ev[3] || {});
      else if (ev[0] === 'remind') p = actSetReminder(p, D(ev[2]), ev[3], on, who);
      else if (ev[0] === 'pause') p = actSetStatus(p, seq, 'paused', on, who, {});
    }
    save(p);
    return p;
  }

  const [nw, bl, cs] = clients;
  /* Northwind: 15 fresh invites for a 12-a-day account shows invite pacing. */
  for (let i = 0; i < 15; i++) scripted(nw, 0, nwSeq.id, i < 3 ? -1 : 0, []);
  scripted(nw, 0, nwSeq.id, -5, [['step', -4], ['accept', 0]]);
  scripted(nw, 0, nwSeq.id, -8, [['step', -7], ['accept', -2]]);
  scripted(nw, 0, nwSeq.id, -9, [['step', -8], ['accept', -3], ['step', -3]]);
  scripted(nw, 0, nwSeq.id, -15, [['step', -14], ['accept', -8], ['step', -8], ['step', -5]]);
  scripted(nw, 0, nwSeq.id, -22, [['step', -21], ['accept', -16], ['step', -16], ['step', -13], ['step', -7]]);
  scripted(nw, 0, nwSeq.id, -12, [['step', -11], ['accept', -9], ['step', -9], ['step', -6], ['reply', -1, 'Asked for pricing and a case study']]);
  scripted(nw, 0, nwSeq.id, -26, [['step', -25]]);
  scripted(nw, 0, nwSeq.id, -24, [['step', -23]]);
  scripted(nw, 0, nwSeq.id, -6, [['step', -5]]);
  scripted(nw, 0, nwSeq.id, -3, [['step', -2]]);
  scripted(nw, 0, nwSeq.id, -20, [['step', -19], ['accept', -15], ['step', -15], ['reply', -12, 'Keen, wants a call'], ['status', -11, 'meeting', { meetingOn: D(2) }]]);
  scripted(nw, 0, nwSeq.id, -18, [['step', -17], ['accept', -14], ['step', -14], ['step', -11], ['reply', -4, 'Interested, back from holiday next week'], ['status', -4, 'interested', { followUpOn: D(0), followUpNote: 'Send the audit one-pager and suggest two slots' }]]);

  /* Brightline: a normal day. */
  for (let i = 0; i < 4; i++) scripted(bl, 0, std.id, 0, []);
  scripted(bl, 0, std.id, -3, [['step', -2], ['accept', -1]]);
  scripted(bl, 0, std.id, -10, [['step', -9], ['accept', -6], ['step', -6], ['step', -3]]);
  scripted(bl, 0, std.id, -7, [['step', -6], ['accept', -4], ['step', -4]]);
  scripted(bl, 0, std.id, -14, [['step', -13], ['accept', -11], ['step', -11], ['reply', 0, 'Replied: "Not now, try us in Q1"']]);
  scripted(bl, 0, std.id, -30, [['step', -29], ['accept', -27], ['step', -27], ['step', -24], ['step', -19], ['step', -12]]);
  scripted(bl, 0, std.id, -16, [['step', -15], ['accept', -12], ['step', -12], ['reply', -10, 'Said timing is wrong'], ['status', -10, 'nurture', { followUpOn: D(0), followUpNote: 'Check in about their Q4 peak season' }]]);
  scripted(bl, 0, std.id, -9, [['step', -8], ['accept', -7], ['step', -7], ['pause', -5]]);

  /* Cedar & Stone: warm-up sequence across two accounts. */
  scripted(cs, 0, warm.id, 0, []);
  scripted(cs, 0, warm.id, -1, [['step', -1]]);
  scripted(cs, 1, warm.id, -3, [['step', -3], ['step', -2]]);
  scripted(cs, 1, warm.id, -2, [['step', -2], ['step', -1]]);
  scripted(cs, 0, warm.id, -9, [['step', -9], ['step', -8], ['step', -7], ['accept', -3], ['step', -3]]);
  scripted(cs, 1, warm.id, -6, [['step', -6], ['step', -5], ['step', -4]]);
  scripted(cs, 0, warm.id, 0, [], { alreadyConnected: true });

  /* Background history over the last 30 days so Reports has something to show. */
  const outcomes = ['not_interested', 'interested', 'meeting', 'nurture'];
  for (const c of clients) {
    const seq = seqs[c.defaultSequenceId];
    const n = c.id === 'cl_demo_cedar' ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const sender = c.senders[i % c.senders.length];
      const start = -28 + Math.floor(rnd() * 24);
      let p = newProspect(Object.assign({ clientId: c.id, senderId: sender.id, startOn: D(start) }, person(c.id)), { seq, today: D(start), by: by(c), source: 'Sample data' });
      p.addedOn = D(start); p.log[0].on = D(start);
      let guard = 0;
      while (guard++ < 12) {
        if (p.status === 'invited') {
          const waited = daysBetween(p.invitedOn, T);
          const accept = rnd() < 0.42;
          const acceptDay = addDays(p.invitedOn, 1 + Math.floor(rnd() * 5));
          if (accept && acceptDay < T) { p = actAccept(p, seq, acceptDay, by(c)); continue; }
          if (!accept && waited > 21 && rnd() < 0.6) p = actWithdraw(p, addDays(p.invitedOn, 22), by(c));
          break;
        }
        if (p.status !== 'queued' && p.status !== 'active') break;
        const idx = stepIndexOf(p, seq);
        const due = stepDue(p, seq, idx, settings);
        if (due >= T) break;
        const doneOn = due;
        p = actCompleteStep(p, seq, doneOn, by(c));
        const st = seq.steps[idx];
        if (groupOf(st.type) === 'message' && rnd() < 0.13) {
          const rOn = addDays(doneOn, Math.floor(rnd() * 3));
          if (rOn < T) {
            p = actReply(p, seq, rOn, by(c));
            const oc = pick(outcomes);
            const hOn = addDays(rOn, 1) < T ? addDays(rOn, 1) : rOn;
            p = actSetStatus(p, seq, oc, hOn, by(c), oc === 'nurture' ? { followUpOn: addDays(T, 5 + Math.floor(rnd() * 20)), followUpNote: 'Check back in' } : oc === 'interested' ? { followUpOn: addDays(T, 1 + Math.floor(rnd() * 5)), followUpNote: 'Send times for a call' } : {});
          }
          break;
        }
      }
      save(p);
    }
  }
  return docs;
}
