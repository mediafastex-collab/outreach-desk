/* Fastex Outreach Desk — help.js
   "How to use" walkthroughs for every screen, opened from a button in each page header. */
'use strict';

const GUIDES = {
  today: {
    title: 'How to use Today',
    steps: [
      { icon: 'today', title: 'Your to-do list for today', body: 'Everything that needs doing today, grouped by LinkedIn account. Log in to one account on LinkedIn and clear its list, then move to the next.', tip: 'The number next to Today in the menu is how many actions are left.' },
      { icon: 'reply', title: 'Answer replies first', body: 'People who replied are pinned at the top of To do. Open their profile, reply on LinkedIn, then click "Log outcome" to record interested, meeting booked, not now or not interested.' },
      { icon: 'send', title: 'Send invites and messages', body: '"Copy & open" copies the message with their name filled in and opens their profile. Paste it on LinkedIn, send it, then click "Sent" (or "Invite sent"). The next step schedules itself.', tip: 'Yellow "placeholder" warnings mean the template still has [brackets] to replace before sending.' },
      { icon: 'userCheck', title: 'Record who accepted', body: 'After you send an invite, the person moves to the "Waiting for acceptance" tab. When they show up as a connection on LinkedIn, click "Accepted". Their Message 1 lands in To do straight away, ready to send.', tip: 'Check acceptances once a day: LinkedIn → My Network → Connections, sorted by "Recently added".' },
      { icon: 'calendar', title: 'See what is coming and what is done', body: '"Upcoming" shows the next 14 days, day by day. "Done today" lists everything logged today with the time and who did it.', tip: 'Logged something by mistake? Use Undo on the pop-up, or open the prospect to fix it.' },
      { icon: 'zap', title: 'Focus run', body: 'Click "Focus run" on an account to go through its tasks one at a time: copy, open, send, next.' },
    ],
  },
  prospects: {
    title: 'How to use Prospects',
    steps: [
      { icon: 'plus', title: 'Add people', body: '"Add prospect" adds one person. "Add in bulk" lets you paste a list of LinkedIn URLs or import a CSV. Only real LinkedIn profile links (linkedin.com/in/…) are accepted.', tip: 'Duplicates inside the same client are skipped automatically.' },
      { icon: 'list', title: 'Organise with lists', body: 'Pick a client in the filter to see its lists (for example "Heads of Data" or "Webinar attendees"). "Create a list" or "Manage lists" adds more.' },
      { icon: 'search', title: 'Find anyone fast', body: 'Search by name, company, headline or tag, and use the status chips to see who is waiting, in sequence, replied and so on.', tip: 'Press Ctrl+K (Cmd+K on a Mac) anywhere to jump to a person.' },
      { icon: 'user', title: 'Open a person', body: 'Click a name to see their journey (Invite → Accepted → Message 1 → …), the next message, reminders and the full history with times. The buttons there do the same as on Today.' },
      { icon: 'checkSquare', title: 'Change many at once', body: 'Tick the boxes on the left, then use Actions to mark steps done, mark accepted, add to a list, move to another sequence or set an outcome.' },
    ],
  },
  activity: {
    title: 'How to use Activity',
    steps: [
      { icon: 'activity', title: 'Everything that happened', body: 'Every invite, message, acceptance, reply and outcome, newest first, with the date, the time and who logged it.' },
      { icon: 'sliders', title: 'Filter it', body: 'Choose a period, a client, a list or a team member, and click a type (Invite sent, Message sent, Replied…) to see only those.' },
      { icon: 'download', title: 'Export', body: '"Export CSV" gives you the same list as a spreadsheet, handy for client reporting or payroll.' },
    ],
  },
  clients: {
    title: 'How to use Clients',
    steps: [
      { icon: 'plus', title: 'Add a client', body: 'Click "Add client", give it a name and choose its account manager.' },
      { icon: 'userPlus', title: 'Add the LinkedIn accounts you send from', body: 'Each client has one or more LinkedIn accounts (for example the founder). Set invites per day and per week so the account stays safe. Extra invites automatically move to the next day.' },
      { icon: 'users', title: 'Account managers', body: '"Account managers" opens the team list. Add, rename or remove people and choose whether they manage clients, run LinkedIn accounts, or both.' },
      { icon: 'route', title: 'Sequences and lists per client', body: 'Each card shows the client\'s sequences and lists. "New" creates a sequence just for that client; "New list" groups their prospects.' },
      { icon: 'pause', title: 'Pause or archive', body: 'The ••• menu pauses a client (their tasks disappear from Today until resumed) or archives it when the campaign ends.' },
    ],
  },
  sequences: {
    title: 'How to use Sequences',
    steps: [
      { icon: 'route', title: 'What a sequence is', body: 'The list of steps every prospect goes through: a connection request, then messages spaced out over days. Each step shows when it happens in plain words.' },
      { icon: 'userCheck', title: 'The acceptance pause', body: 'After the connection request the sequence waits until you mark the person as Accepted. The next step counts its days from that moment.' },
      { icon: 'edit', title: 'Edit a step', body: 'Click any step to open it. Choose what happens, how many days after the previous step, an optional send time, and the message. Insert first name, company and more with one click.' },
      { icon: 'plus', title: 'Add, move or remove steps', body: '"+ Add step here" inserts a step between two others. Inside a step you can move it up or down, or delete it.' },
      { icon: 'briefcase', title: 'One per client', body: '"New sequence" can be for all clients or for one client, and can be that client\'s default for new prospects.' },
      { icon: 'check', title: 'Save', body: 'Changes are not live until you click "Save sequence". People already in the sequence pick up the change on their next step.' },
    ],
  },
  reports: {
    title: 'How to use Reports',
    steps: [
      { icon: 'calendar', title: 'Pick a period and client', body: 'Choose 7 days, 30 days, this month and so on, and one client or all.' },
      { icon: 'chart', title: 'Read the numbers', body: 'Acceptance rate = invites accepted ÷ invites sent in the period. Reply rate = people who replied ÷ people messaged. "Which step got the reply" shows which message works best.' },
      { icon: 'copy', title: 'Send a client update', body: '"Copy report" copies a ready-to-paste summary for email or WhatsApp. The client table has one per client.' },
    ],
  },
  settings: {
    title: 'How to use Settings',
    steps: [
      { icon: 'users', title: 'Account managers & team', body: 'Add everyone who manages clients or runs LinkedIn accounts. Then pick "On this device, I am" so the work you log is signed with your name.' },
      { icon: 'calendar', title: 'Working days and reminder', body: 'Due dates on non-working days move to the next working day. The Google Calendar button adds a weekday reminder to open the desk.' },
      { icon: 'download', title: 'Backups', body: 'Export a backup now and then. You can restore it on another computer or browser.' },
    ],
  },
};

function HelpModal({ view }) {
  const g = GUIDES[view] || GUIDES.today;
  const [i, setI] = useState(0);
  const step = g.steps[i];
  const last = i === g.steps.length - 1;
  const done = () => { pref('seenHelp.' + view, true); UI.close(); };
  useEffect(() => {
    const onKey = e => { if (e.key === 'ArrowRight' && !last) setI(i + 1); if (e.key === 'ArrowLeft' && i > 0) setI(i - 1); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [i]);
  return html`<${Modal} title=${g.title} onClose=${done}
    foot=${html`
      <span class="left mono muted">Step ${i + 1} of ${g.steps.length}</span>
      <button type="button" class="btn" disabled=${i === 0} onClick=${() => setI(i - 1)}><${Icon} n="chevLeft" s=${14} />Back</button>
      ${last ? html`<button type="button" class="btn primary" onClick=${done}><${Icon} n="check" s=${14} />Got it</button>`
        : html`<button type="button" class="btn primary" onClick=${() => setI(i + 1)}>Next<${Icon} n="chevRight" s=${14} /></button>`}`}>
    <div class="guide">
      <div class="guide-dots" role="tablist" aria-label="Steps">
        ${g.steps.map((s, k) => html`<button type="button" key=${k} role="tab" aria-selected=${k === i ? 'true' : 'false'} aria-label=${'Step ' + (k + 1) + ': ' + s.title} class=${k === i ? 'on' : k < i ? 'seen' : ''} onClick=${() => setI(k)}></button>`)}
      </div>
      <div class="guide-card" key=${i}>
        <span class="guide-ic"><${Icon} n=${step.icon} s=${22} /></span>
        <div class="guide-num mono">${pad2(i + 1)}</div>
        <h3>${step.title}</h3>
        <p>${step.body}</p>
        ${step.tip && html`<p class="guide-tip"><${Icon} n="info" s=${14} />${step.tip}</p>`}
      </div>
      <ol class="guide-index">
        ${g.steps.map((s, k) => html`<li key=${k}><button type="button" class=${k === i ? 'on' : ''} onClick=${() => setI(k)}>${s.title}</button></li>`)}
      </ol>
    </div>
  <//>`;
}

function HelpButton({ view }) {
  return html`<button type="button" class="btn help-btn" onClick=${() => UI.open('help', { view })}><${Icon} n="help" s=${15} />How to use</button>`;
}

/* A slim, dismissible nudge the first time someone opens a screen. */
function PageHint({ view }) {
  const [hidden, setHidden] = useState(!!pref('seenHelp.' + view));
  useEffect(() => { setHidden(!!pref('seenHelp.' + view)); }, [view]);
  if (hidden || !GUIDES[view]) return null;
  const dismiss = () => { pref('seenHelp.' + view, true); setHidden(true); };
  return html`<div class="hint-bar">
    <${Icon} n="help" s=${16} />
    <p>New to this screen? A ${GUIDES[view].steps.length}-step walkthrough shows how it works.</p>
    <button type="button" class="btn sm primary" onClick=${() => { dismiss(); UI.open('help', { view }); }}>Show me</button>
    <button type="button" class="btn sm ghost" onClick=${dismiss}>Not now</button>
  </div>`;
}
