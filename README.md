# PAAQ personal workboard

A standalone Next.js + TypeScript + Tailwind app with SQLite and persistent file uploads. Starts with an empty dashboard. No organisations, AI keys, paid services, or ChatGPT account required.

## Run locally

Requires **Node.js 22.13+** (uses built-in `node:sqlite`) and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Keep that terminal running. Stop with Ctrl+C. Records remain in `data/workboard.sqlite`, and files in `data/evidence/`. Restart with the same command and directory. The experimental SQLite notice from Node 22 is expected.

Local development binds only to loopback and needs no login. To use a password locally, copy `.env.example` to `.env.local`, set `APP_PASSWORD`, and restart.

## Daily use

- **Today** opens first. Totals navigate to the records counted. Meeting reminders use Africa/Johannesburg time; edit them in Settings.
- **Workboard:** add just a title. Drag cards or use their status menu. Search, filter, sort, or switch to list view.
- **Release Testing:** create a release with its name and product, then add checks with just titles. Feature groups and platform tabs separate checks. Supporting details are expandable. Copying to another platform creates an independent check with blank results.
- **Retests:** open a failed check in Defects & Retests and select Record retest. Record the result you observed and save. Every recorded result captures a snapshot of actual behaviour and evidence. Earlier failures remain in Result history. Changing workflow status alone never records a pass.
- **Templates:** create reusable checklists or save a release as a template. Applying one creates new checks without results, actuals, blockers, defects, retest outcomes, files, or history.
- **Messages:** paste Slack text manually and review it before creating tasks or checks. Imported announcements are never interpreted as results.
- **Reports:** choose a release or weekly dates, generate, edit, copy, and optionally save. Missing feature goals/value are labelled Needs clarification. Reports group work by product/feature and distinguish resolved historical failures.
- Delete actions ask for confirmation. Restore any deleted record in Settings → Recently deleted.

## Persistence and backup

SQLite is the primary database. Writes use a revision comparison: another tab's newer save produces a visible conflict instead of overwriting it. Reload latest to discard the pending change and then reapply it; transient errors can be retried. Editors remain open if saving fails.

Settings provides JSON backup and merge import; matching IDs are replaced after confirmation. CSV export is available inside a release. JSON backups include evidence references, **not file contents**. Back up the entire `data/` directory to preserve evidence and the optional Slack token. Stop the app before copying the folder, or use SQLite's backup tooling to make a consistent online database backup. Treat backups as private.

Uploads are limited to 20 MB each, served as authenticated downloads, and kept after removing references so historical evidence stays recoverable. Deleting a release does not delete its checks; restore the release or move the checks to another release using the editor.

## Private deployment

Use a Node-capable private server/container with a **persistent disk**, not a static host or an ephemeral/serverless filesystem. One app instance is appropriate for this personal dashboard. Sites' Worker hosting cannot directly run this Node SQLite build; this repository is prepared for independent Node hosting.

```sh
npm ci
npm run build
APP_PASSWORD='your-long-password' COOKIE_SECURE=true APP_URL=https://workboard.example.com DATA_DIR=/var/lib/paaq npm start
```

Create `/var/lib/paaq` with permissions for the app user first. Put an HTTPS reverse proxy (Caddy/nginx) in front of port 3000, preserve the Host header, and proxy to 127.0.0.1:3000. Set the public origin in APP_URL so origin checks work. Use a service manager to keep it running. Keep secrets in the host's secret/environment manager; do not commit them. `npm start` binds to loopback. Production data and evidence endpoints reject access unless APP_PASSWORD is configured and the visitor signs in. Password changes invalidate existing sessions. COOKIE_SECURE=true requires HTTPS.

For a production build used **only on your own computer**, `ALLOW_LOCAL_NO_AUTH=true npm start` allows local access without a password; keep the loopback binding.

## Optional real Slack connection

Only this feature needs external credentials. Manual paste works without it.

1. Create an app at https://api.slack.com/apps for your workspace.
2. Set OAuth redirect URL to exactly `APP_URL/api/slack` (for local use, Slack may require a publicly reachable HTTPS tunnel).
3. Add bot OAuth scopes: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `users:read`. Your workspace administrator may need to approve installation. Invite the bot into channels to import.
4. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `APP_URL` on the server; restart.
5. Settings → Connect with Slack → Load channels → select a channel and dates → Import for review. Repeat for additional channels.

The server uses Slack OAuth v2 and Web API. Tokens stay in the server database, never in the browser or JSON exports. Imports preserve original text, author ID/name, timestamp, channel, permalink, and accessible thread context. Import identity is channel + timestamp, so re-imports skip duplicates. Threads unavailable to the bot are explicitly labelled. Slack's bot thread restrictions, app permissions, and API rate limits may limit imports; errors are shown and imports can be retried. Progress indicates the active import, and the last successful API sync time is shown. No automatic messaging or background sync runs.

## Verification

```sh
npm test
npm run build
```

`npm test` verifies minimal records, retest preservation, fresh templates, platform independence, readiness, attention deduplication, report accuracy, SQLite persistence, recovery, and conflicting writes.

For the browser workflow check, run a local **test instance** on port 3107, then:

```sh
npm run dev -- --port 3107
# in a second terminal
node tests/browser.mjs
```

Playwright Chromium must be installed (`npx playwright install chromium`). The browser script restores the initial records in a finally block; do not edit the dashboard concurrently during this check. It covers creating minimal records, refresh persistence, status menus, platform copies, retest history, templates, recovery, messages, reports and mobile navigation.

Reference documentation: [Slack OAuth v2](https://docs.slack.dev/authentication/installing-with-oauth/), [thread access restrictions](https://docs.slack.dev/reference/methods/conversations.replies/), and [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
