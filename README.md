# Fastex Outreach Desk

A tracker for manual LinkedIn outreach across many clients. It never sends anything. It tells your team who to contact today, for which client, from which LinkedIn account, with which message, and keeps score.

- `PROMPT.md`: the refined master prompt / product spec the app was built from.
- `app/`: the app (plain HTML, CSS and JavaScript; Preact and htm load from a CDN).

## Running it

**Shared (recommended):** use the published link. Data lives in the page's shared storage, so everyone you give edit access sees the same workspace live.

**Locally:** serve the `app` folder and open it in a browser. Data is saved in that browser only.

```bash
python3 -m http.server 5178 --directory app
```

Then open http://localhost:5178.

## First-time setup

1. **Settings → Account managers & team**: add your account managers and the people who run LinkedIn accounts.
2. **Clients → Add client**: name, account manager, and the LinkedIn account(s) you send from.
3. **Sequences**: adjust the default cadence or create one per client.
4. **Prospects → Add in bulk**: paste LinkedIn profile URLs or import a CSV. Only real LinkedIn profile links are accepted.

## Daily routine

1. **Check acceptances** for each LinkedIn account (Today → Pending invites → Check acceptances).
2. **Answer replies**. They're pinned at the top of Today.
3. **Send the follow-ups** that are due, account by account. "Copy & open" copies the filled-in message and opens the profile.
4. **Send new invites**. Each account only gets as many as its daily and weekly limits allow; the rest roll forward.
5. Once a week, **withdraw** invites pending more than 21 days.

## How the cadence works

Default sequence: connection request → Message 1 when they accept → Message 2 three days later → Message 3 five days after that → Message 4 seven days after that. Delays count from when the previous step was actually done, due dates skip non-working days, and a reply stops the sequence. Edit or add sequences under **Sequences**.

## Files in `app/`

| File | What it holds |
|---|---|
| `engine.js` | Dates, cadence rules, the daily queue, analytics, CSV |
| `store.js` | Shared storage, browser storage and sample-data backends |
| `today.js` | Today screen, acceptance check, focus run, reply dialogs |
| `prospects.js` | Prospect list, detail panel, add and bulk import |
| `setup.js` | Clients, sequences, settings |
| `reports.js` | Reports and charts |
| `activity.js` | Activity feed with date, time and type of every action |
| `ui.js`, `actions.js`, `main.js` | Shared components, actions with undo, app shell |
