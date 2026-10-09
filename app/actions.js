/* Fastex Outreach Desk — actions.js
   Every change a person makes goes through here: engine transition, save, toast with Undo. */
'use strict';

function me() { return UI.me || null; }
function seqFor(p) { return currentData().seqs[p.sequenceId] || null; }
function findProspect(cid, pid) { const ds = Store.active(); return (ds && ds.prospects[cid] && ds.prospects[cid][pid]) || null; }
function fresh(p) { return (p && findProspect(p.clientId, p.id)) || p; }

const Act = {
  async commit(before, after, message) {
    if (!W.guard()) return false;
    const ok = await W.saveProspect(after);
    if (ok && message) UI.toast(message, before ? { undo: () => W.saveProspect(before) } : null);
    return ok;
  },
  done(p, on, time) {
    const seq = seqFor(p);
    if (!seq) { UI.toast('This prospect has no sequence. Pick one in their details.', { bad: true }); return Promise.resolve(false); }
    const i = stepIndexOf(p, seq);
    const step = seq.steps[i];
    const verb = step && step.type === 'connect' ? 'Invite sent to ' : step && groupOf(step.type) === 'message' ? stepShort(seq, i) + ' sent to ' : stepShort(seq, i) + ' done for ';
    const d = on || TODAY;
    const next = retime(actCompleteStep(p, seq, d, me()), (p.log || []).length, d, time);
    const live = (!on || on === TODAY) && !time;
    return Act.commit(p, next, verb + fullName(p) + (on && on !== TODAY ? ' (logged for ' + fmtDay(on) + (time ? ' ' + fmtClock(time) : '') + ')' : '') + '.').then(ok => {
      if (ok && live && step) {
        const secs = startCooldown(acctKeyOf(p));
        if (secs) UI.toasts[UI.toasts.length - 1].text += ' Next send on this account in ' + secs + 's.';
      }
      return ok;
    });
  },
  skip(p) {
    const seq = seqFor(p);
    if (!seq) return Promise.resolve(false);
    const i = stepIndexOf(p, seq);
    return Act.commit(p, actSkip(p, seq, TODAY, me()), 'Skipped ' + stepShort(seq, i) + ' for ' + fullName(p) + '.');
  },
  accept(p, on, time) {
    const d = on || TODAY;
    const next = retime(actAccept(p, seqFor(p), d, me()), (p.log || []).length, d, time);
    return Act.commit(p, next, fullName(p) + ' accepted. ' + (next.status === 'active' ? 'First message is now on the list.' : ''));
  },
  reply(p, on, note, outcome, opts, time) {
    const seq = seqFor(p);
    let next = retime(actReply(p, seq, on || TODAY, me(), note), (p.log || []).length, on || TODAY, time);
    if (outcome && outcome !== 'replied') next = actSetStatus(next, seq, outcome, on || TODAY, me(), opts || {});
    return Act.commit(p, next, 'Reply logged for ' + fullName(p) + '. Sequence stopped.');
  },
  outcome(p, status, opts) {
    return Act.commit(p, actSetStatus(p, seqFor(p), status, TODAY, me(), opts || {}), fullName(p) + ' marked ' + STATUSES[status].label.toLowerCase() + '.');
  },
  resume(p) {
    return Act.commit(p, actResume(p, seqFor(p), TODAY, me()), 'Sequence resumed for ' + fullName(p) + '.');
  },
  pause(p) {
    return Act.commit(p, actSetStatus(p, seqFor(p), 'paused', TODAY, me(), {}), fullName(p) + ' paused.');
  },
  snooze(p, until, time) {
    return Act.commit(p, actSnooze(p, until, TODAY, me(), time), fullName(p) + ' snoozed until ' + fmtDay(until) + (time ? ' at ' + fmtClock(time) : '') + '.');
  },
  withdraw(p, remindOn) {
    return Act.commit(p, actWithdraw(p, TODAY, me(), remindOn), 'Invite to ' + fullName(p) + ' marked withdrawn.' + (remindOn ? ' Reminder set for ' + fmtDay(remindOn) + '.' : ''));
  },
  restart(p, skipInvite) {
    const seq = seqFor(p);
    if (!seq) return Promise.resolve(false);
    return Act.commit(p, actRestart(p, seq, TODAY, me(), skipInvite), fullName(p) + ' restarted from the ' + (skipInvite ? 'first message' : 'first step') + '.');
  },
  remind(p, date, note, time) {
    return Act.commit(p, actSetReminder(p, date, note, TODAY, me(), time), 'Reminder set for ' + fmtDay(date) + (time ? ' at ' + fmtClock(time) : '') + '.');
  },
  reminderDone(p) {
    return Act.commit(p, actReminderDone(p, TODAY, me()), 'Reminder cleared for ' + fullName(p) + '.');
  },
  engage(p, channel, note, on, time) {
    const d = on || TODAY;
    const next = retime(actEngage(p, channel, note, d, me()), (p.log || []).length, d, time);
    return Act.commit(p, next, 'Logged for ' + fullName(p) + ': ' + (ENGAGE_TYPES[channel] || ENGAGE_TYPES.other).label.toLowerCase() + '.');
  },
  setList(p, listId, listName) {
    return Act.commit(p, actSetList(p, listId, listName, TODAY, me()), fullName(p) + (listId ? ' added to ' + listName + '.' : ' removed from the list.'));
  },
  note(p, text) {
    return Act.commit(p, actNote(p, text, TODAY, me()), null);
  },
  changeSequence(p, seq, idx) {
    return Act.commit(p, actChangeSequence(p, seq, idx, TODAY, me()), fullName(p) + ' moved to ' + seq.name + '.');
  },
  update(p, patch, message) {
    const next = Object.assign(clone(p), patch, { updatedAt: nowTs() });
    return Act.commit(p, next, message || null);
  },
  async move(p, clientId, senderId) {
    if (!W.guard()) return false;
    if (clientId === p.clientId) return Act.update(p, { senderId }, 'Account updated.');
    const data = currentData();
    const target = data.prospects.find(x => x.clientId === clientId && x.id === p.id);
    if (target) { UI.toast('That person is already a prospect for the other client.', { bad: true }); return false; }
    const next = Object.assign(clone(p), { clientId, senderId, updatedAt: nowTs() });
    const ok = await W.saveProspect(next);
    if (!ok) return false;
    await W.deleteProspect(p);
    UI.drawer = { cid: clientId, pid: p.id };
    UI.toast(fullName(p) + ' moved to ' + (data.clients[clientId] || {}).name + '.');
    return true;
  },
  async remove(p) {
    if (!W.guard()) return false;
    const ok = await W.deleteProspect(p);
    if (ok) {
      if (UI.drawer && UI.drawer.pid === p.id) UI.closeDrawer();
      UI.toast(fullName(p) + ' deleted.', { undo: () => W.saveProspect(p) });
    }
    return ok;
  },
  /* Apply fn to many prospects; one toast with Undo for the whole batch. */
  async bulk(ps, fn, describe) {
    if (!W.guard()) return;
    const pairs = [];
    for (const p of ps) { const n = fn(p); if (n) pairs.push([p, n]); }
    if (!pairs.length) { UI.toast('Nothing to change for that selection.'); return; }
    const res = await W.many(pairs, pr => W.put(prospectPath(pr[1]), pr[1], true));
    const ok = pairs.length - res.failed;
    if (res.failed) UI.toast(res.failed + ' changes could not be saved. ' + ok + ' saved.', { bad: true });
    else UI.toast(describe(ok), { undo: () => W.many(pairs, pr => W.put(prospectPath(pr[0]), pr[0], true)) });
  },
  async bulkDelete(ps) {
    if (!W.guard()) return;
    const res = await W.many(ps, p => W.del(prospectPath(p), true));
    const ok = ps.length - res.failed;
    UI.toast(plural(ok, 'prospect') + ' deleted.', { undo: () => W.many(ps, p => W.put(prospectPath(p), p, true)) });
  },
};

/* ---------- opening the right dialog for a task ---------- */
function openDoneOnDate(p) {
  const seq = seqFor(p);
  const i = seq ? stepIndexOf(p, seq) : 0;
  UI.open('date', {
    title: 'Log ' + (seq ? stepShort(seq, i).toLowerCase() : 'step') + ' on a date',
    sub: 'Use this when you did it earlier and forgot to log it. The next step counts from this date.',
    confirmLabel: 'Log it', withTime: true, timeLabel: 'At (optional)',
    onConfirm: (d, note, time) => Act.done(p, d, time),
  });
}
function openAcceptOnDate(p) {
  UI.open('date', {
    title: 'When did ' + (p.firstName || 'they') + ' accept?',
    sub: 'Message 1 is scheduled from the acceptance date.',
    confirmLabel: 'Mark accepted',
    presets: [{ label: 'Today', value: TODAY }, { label: 'Yesterday', value: addDays(TODAY, -1) }, { label: '2 days ago', value: addDays(TODAY, -2) }],
    withTime: true, timeLabel: 'At (optional)',
    onConfirm: (d, note, time) => acceptAndGuide(p, d),
  });
}
function openSnooze(p) {
  UI.open('date', {
    title: 'Snooze ' + fullName(p),
    sub: 'The task disappears until this date. The rest of the cadence is unchanged.',
    confirmLabel: 'Snooze', withTime: true, timeLabel: 'Remind me at (optional)',
    initial: addDays(TODAY, 1),
    presets: [{ label: 'Tomorrow', value: addDays(TODAY, 1) }, { label: '+3 days', value: addDays(TODAY, 3) }, { label: 'Next week', value: addDays(TODAY, 7) }],
    onConfirm: (d, note, time) => Act.snooze(p, d, time),
  });
}
function openReminder(p) {
  UI.open('date', {
    title: 'Remind me about ' + fullName(p),
    sub: 'Shows up on the Today list on this date, next to their account.',
    confirmLabel: 'Set reminder',
    initial: p.followUpOn || addDays(TODAY, 3), initialTime: p.followUpTime || '',
    withTime: true, timeLabel: 'At (optional)',
    presets: [{ label: 'Tomorrow', value: addDays(TODAY, 1) }, { label: '+3 days', value: addDays(TODAY, 3) }, { label: 'Next week', value: addDays(TODAY, 7) }, { label: 'In a month', value: addDays(TODAY, 30) }],
    withNote: true, noteLabel: 'What to do', notePlaceholder: 'Send the case study they asked for',
    onConfirm: (d, note, time) => Act.remind(p, d, note, time),
  });
}
function openWithdraw(p) {
  UI.open('withdraw', { p });
}
function taskMenuItems(task) {
  const p = task.p;
  const items = [];
  if (task.kind === 'step') {
    items.push({ label: 'Log on another date…', icon: 'calendar', onSelect: () => openDoneOnDate(p) });
    items.push({ label: 'Snooze…', icon: 'clock', onSelect: () => openSnooze(p) });
    items.push({ label: 'Skip this step', icon: 'skip', onSelect: () => Act.skip(p) });
    items.push({ divider: true });
    items.push({ label: 'They replied…', icon: 'reply', onSelect: () => UI.open('reply', { p }) });
    items.push({ label: 'Pause prospect', icon: 'pause', onSelect: () => Act.pause(p) });
    items.push({ label: 'Snooze to 1 hour from now', icon: 'clock', onSelect: () => { const d = new Date(Date.now() + 3600000); Act.snooze(p, isoOf(d), pad2(d.getHours()) + ':' + pad2(d.getMinutes())); } });
  } else if (task.kind === 'reminder') {
    items.push({ label: 'Change date…', icon: 'calendar', onSelect: () => openReminder(p) });
    items.push({ label: 'They replied…', icon: 'reply', onSelect: () => UI.open('reply', { p }) });
  } else if (task.kind === 'reply') {
    items.push({ label: 'Resume sequence (out of office)', icon: 'play', onSelect: () => Act.resume(p) });
    items.push({ label: 'Set a reminder…', icon: 'bell', onSelect: () => openReminder(p) });
  } else if (task.kind === 'pending') {
    items.push({ label: 'Accepted today', icon: 'userCheck', onSelect: () => acceptAndGuide(p, TODAY) });
    items.push({ label: 'Accepted on a date…', icon: 'calendar', onSelect: () => openAcceptOnDate(p) });
    items.push({ label: 'Check again in a week', icon: 'clock', onSelect: () => Act.snooze(p, addDays(TODAY, 7)) });
    items.push({ label: 'They replied…', icon: 'reply', onSelect: () => UI.open('reply', { p }) });
    items.push({ label: 'Withdraw invite…', icon: 'logout', onSelect: () => openWithdraw(p) });
  }
  items.push({ divider: true });
  items.push({ label: 'Log engagement…', icon: 'thumbsUp', onSelect: () => UI.open('engage', { p }) });
  items.push({ label: 'Add to a list…', icon: 'list', onSelect: () => UI.open('setList', { ps: [p] }) });
  items.push({ label: 'Open details', icon: 'user', onSelect: () => UI.openProspect(p) });
  return items;
}
