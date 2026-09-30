# Master prompt: LinkedIn outreach tracker for a multi-client agency

> Paste this into any capable AI builder (Claude, Cursor, Lovable, Bolt) or hand it to a developer.
> It is the refined version of the original idea and is the spec the app in `app/` was built from.

---

## Role

You are a senior product engineer who has also run manual LinkedIn outreach for B2B agencies.
Build the tool below end to end. Where this brief is silent, choose what an experienced outreach
operator would expect, and list those choices at the end of your answer.

## Context

- We are an outreach agency. We run LinkedIn outreach **by hand** for several clients, usually from
  each client's own LinkedIn account (some clients have more than one sending account).
- Nothing is automated: no LinkedIn API, no scraping, no browser extension, no auto-sending.
  The tool tells us **who to contact, when, from which account, with which message**, and we record what we did.
- Our standard cadence:
  1. Connection request
  2. When they accept: **Message 1** (same day)
  3. 3 days after Message 1: **Message 2**
  4. 5 days after Message 2: **Message 3**
  5. 7 days after Message 3: **Message 4** (breakup)
- The cadence must be editable: add, remove and reorder steps, change delays and templates, and keep
  several sequences (shared across clients or specific to one client).

## Goal

One screen each morning that answers: *"What do I need to send today, to whom, for which client,
from which account?"* Nobody should miss a follow-up because they forgot.

## Users

- **Owner / account manager**: sets up clients, accounts and sequences; reads reports; sends client updates.
- **Operator (SDR)**: works the daily list for the LinkedIn accounts they run and logs what happened.

## Data model

| Object | Fields |
|---|---|
| Client | name, color, status (active / paused / archived), account manager, default sequence, notes (ICP, offer, booking link) |
| Sender account | the LinkedIn profile we send from; belongs to a client. Name, profile URL, operator (team member), invites per day (default 20), invites per week (default 100), messages per day (default 50) |
| Sequence | name, scope (all clients or one client), ordered steps |
| Step | type (connection request, message, InMail, voice note, profile visit, like/comment, follow, custom task), label, delay in days, message template |
| Prospect | client, sender account, sequence, current step, status, first/last name, headline, company, location, email, LinkedIn URL (required, normalized), tags, notes, key dates (added, start, invited, accepted, replied), snooze date, custom reminder (date + note), activity log |
| Activity | date, type, step, who did it, note. Every report is computed from this log |
| Team member | name. Each person picks "I am ..." so their activity is signed and they can filter to their accounts |

## Sequence rules (the scheduling engine)

1. **Delays count from when the previous step was actually done**, not when it was scheduled.
   If Message 2 goes out two days late, Message 3 is still due 5 days after the real send.
2. The step after the connection request **waits for acceptance**; its delay counts from the acceptance date.
3. Steps before the connection request (profile visit, like a post) count from the prospect's start date.
4. **Working days**: a due date that lands on a non-working day (default Sat/Sun) moves to the next working day.
5. **A reply stops the sequence immediately.** Out-of-office replies can resume it.
6. Invites pending longer than N days (default 21) get a **withdraw** task. LinkedIn blocks re-inviting for
   about 3 weeks after a withdrawal, so offer a reminder to re-invite later.
7. After the last step the prospect becomes **No reply** (sequence finished). A late reply can still be logged.
8. Prospects who are **already connected** skip the connection request and start at Message 1.
9. Editing a sequence changes upcoming steps for everyone in it; finished steps keep their history.
   Track position by **step id**, not index, so inserting or reordering steps doesn't move people backwards.
10. **Snooze** moves one task to a later date without changing the cadence. **Skip** moves to the next step without sending.
11. **Invite pacing**: never plan more invites for an account than today's allowance
    (the smaller of daily limit left and weekly limit left). The rest roll to the next day.

**Worked example** (Mon–Fri working days, default cadence): invite sent Wed 30 Sep → accepted Fri 2 Oct →
Message 1 due Fri 2 Oct and sent that day → Message 2 due Mon 5 Oct, sent → Message 3 due Sat 10 Oct,
moved to Mon 12 Oct, sent → Message 4 due Mon 19 Oct.

## Status lifecycle

| Status | Meaning | What the daily list shows |
|---|---|---|
| Not started | Added, nothing sent yet | the first step on its due date |
| Invite pending | Connection request sent | acceptance check; "withdraw" after N days |
| In sequence | Connected, follow-ups running | the next message on its due date |
| Replied | They answered, sequence stopped | "reply now", pinned to the top |
| Interested | Positive reply | the follow-up reminder you set |
| Follow up later | "Not now" | reminder on the chosen date |
| Meeting booked | Success | nothing |
| Not interested | Closed | nothing |
| No reply | Sequence finished | nothing |
| Invite withdrawn | Closed; can restart later | optional re-invite reminder |
| Paused | On hold | nothing until resumed |

## Screens

1. **Today** (home)
   - Summary: replies waiting, overdue, due today, pending invites, done today (with a progress bar).
   - Replies waiting come first; they're the most valuable thing on the list.
   - Tasks grouped **by LinkedIn account**, because an operator logs into one account at a time.
     Order inside an account: messages, then touches, then invites. Show the account's invite
     allowance ("8 of 20 today, 38 of 100 this week").
   - Each task: name, headline, client, step ("Message 2 of 4"), due state (overdue by N days / today),
     the message with variables filled in, and a character count for connection notes (300 max, 200 on free accounts).
   - One-click actions: open profile, copy message, copy-and-open, mark sent, replied, snooze, skip, pause,
     log on another date. **Undo** after every action.
   - Pending invites per account: tick who accepted (today / yesterday / pick a date) and withdraw stale ones.
     Links to LinkedIn's Connections and Sent invitations pages.
   - Next 7 days preview. A focus mode that walks one account's tasks one at a time.
   - "Copy today's plan" as plain text for Slack or WhatsApp.
2. **Prospects**: search, filters (client, account, status, sequence, tag), status counts, bulk actions
   (mark step done, mark accepted, set outcome, move to sequence, pause, delete). A detail panel with a
   step-by-step timeline (done dates and projected dates), editable fields, notes, reminder and activity log.
3. **Add prospects**: single form; paste a list of LinkedIn URLs (names inferred from the URL);
   CSV import with column mapping, preview and duplicate detection. The same URL twice in one client is blocked;
   the same person under another client is flagged.
4. **Clients**: cards with sender accounts, today's usage, pending invites and pipeline counts; add, edit, archive.
5. **Sequences**: editor with steps, delays, templates, variable chips, a cadence ruler
   (Day 0 → accepted → Day 0 → Day 3 → Day 8 → Day 15) and validation (one connection request per sequence;
   plain messages need a connection first).
6. **Reports**: by client and period: invites, acceptance rate, messages, replies, reply rate, meetings;
   which step earned the replies; daily activity chart with a table view; client comparison; team activity;
   "Copy client report".
7. **Settings**: agency name, team, working days, stale-invite threshold, reminder time, backups
   (CSV and JSON export, JSON import), sample data.

## Message templates

Variables: `{{firstName}} {{lastName}} {{fullName}} {{company}} {{title}} {{location}} {{senderFirstName}}
{{senderName}} {{clientName}}`. A missing value renders as `[company]` and is flagged on the task, so nobody
sends "Hi {{firstName}}".

## Reminders (without automation)

The Today list is the reminder system. Add: counts per client and account, "copy today's plan",
and a Google Calendar link that creates a weekday reminder at the team's start time.

## LinkedIn safety guardrails (expert defaults)

- 15–25 invites a day per account and about 100 a week.
- Withdraw invites older than 3 weeks; keep the pending list small.
- Connection notes under 300 characters (free accounts: 200). A blank note is fine.
- No pitch in the invite or Message 1. Vary the first line of templates between clients.
- Don't send on weekends. Space messages out; the tool never plans two steps on one day.

## Non-goals

No automation, scraping or LinkedIn login. No deal pipeline, invoicing or email sending.

## Technical requirements (for this build)

- Single-page web app that works on desktop and phone, in light and dark themes.
- Shared team data with live updates; falls back to browser storage when opened as a plain file.
- All scheduling computed on the client from stored records; no server jobs.
- LinkedIn URL normalization: accept `linkedin.com/in/...` with or without `https://` / `www`, query strings
  and trailing slashes. Sales Navigator lead URLs are accepted and labelled.
- Deterministic prospect ids from the normalized URL, so the same person can't be created twice in a client.

## Acceptance tests

1. Add a prospect → a connection request appears in Today.
2. Mark the invite sent → prospect moves to Invite pending; nothing else is due until acceptance.
3. Mark accepted today → Message 1 is due today.
4. Mark Message 1 sent → Message 2 is due in 3 days (moved off weekends).
5. Mark Message 2 sent 2 days late → Message 3 is due 5 days after the actual send.
6. Log a reply at any stage → later steps disappear; the prospect is pinned until an outcome is chosen.
7. Change Message 3's delay from 5 to 4 → everyone waiting on Message 3 updates.
8. Account limited to 20 invites a day with 35 queued → 20 show today, 15 roll forward.
9. Invite pending 21+ days → a Withdraw task appears.
10. Import the same CSV twice → no duplicates.
11. Undo after "Mark sent" restores the previous state exactly.

## Additions (round 2)

- **Per-client sequences.** Every client can have its own sequences (cadence, messages, send times) and a default one. Shared templates stay available; create a client's sequence from a template or by copying another sequence.
- **Send times.** Each step can carry a clock time ("Message 2 at 11:00"). Snoozes, reminders and back-dated logs take a time too. Today shows an hour-by-hour schedule and sorts timed tasks in clock order.
- **Client-wise lists.** Each client has lists of prospects (by campaign, segment or source). A list can have its own default sequence. Filter Today, Prospects and Activity by list; add prospects to a list one by one, in bulk, or during import.
- **Activity with type, date and time.** Every logged action is stored with its timestamp and who logged it. Prospects show their last activity; each prospect's history and a team-wide Activity screen show type, date and time, with filters and CSV export.
- **Smoother use.** Ctrl/Cmd+K quick find, light/dark/auto theme switch, grouped schedule, list and sequence shortcuts on client cards.

## Deliverables

The working app, a short daily routine inside the app, and a list of assumptions made.
