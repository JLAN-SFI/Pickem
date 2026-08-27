# Pick 'Em — self-hosted web app

This is the browser tool you already had, with one important change: it now
talks to a real tiny backend for shared data (members, picks, weekly game
selections, deadlines, prize pot) instead of Claude.ai's artifact storage —
which only works inside Claude.ai and silently does nothing once a file is
downloaded and opened on its own. This version works anywhere, for everyone
who opens the URL, because the storage is a real server now.

New in this version: a **Field** tab showing season standings as an actual
football field — each person's name on its own lane, a yard-line ruler, and a
gold marker showing their yardage (yards = games picked correctly this
season).

## Run it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deploy it so your team can use it

Any small Node host works — Render, Railway, Fly.io, a company server, etc.
On Render, for example:

1. Push this folder to a GitHub repo.
2. **New → Web Service**, connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Deploy. Render gives you a public URL, e.g. `https://pickem.onrender.com`.
4. Share that URL with your team (drop it in Slack, bookmark it, whatever) —
   everyone who opens it sees the same live picks, standings, and pot.

## Protecting Admin mode with a password

Admin mode (choosing the week's 3 games, setting the deadline, setting the
prize pot) is gated by a password — enforced by the server, not just hidden
in the page, so it can't be bypassed by viewing source.

**On Render:** go to your service → **Environment** → add a variable:
- Key: `ADMIN_PASSWORD`
- Value: whatever password you want

Save, and Render will redeploy automatically. Anyone who taps "Admin" in the
app will be asked for that password before they can change anything. Regular
picking is unaffected — no password needed for that.

**Locally:** copy `.env.example` to `.env` and set `ADMIN_PASSWORD` there.

If `ADMIN_PASSWORD` is never set at all, Admin mode is left open with no
password — fine for just testing locally, not recommended once you've shared
the real URL with your team.

## Data storage — set this up before sharing the URL with your team

**This step is required, not optional.** On Render (and most similar hosts),
the filesystem resets on every redeploy — anything written at runtime,
including all your picks, is wiped clean. The app now uses **Upstash Redis**
instead, which is free forever and actually persists.

1. Go to [upstash.com](https://upstash.com), sign up (no credit card).
2. Create a new Redis database (any region close to you is fine).
3. On the database's page, find the **REST API** section — copy the
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values.
4. On Render: your service → **Environment** → add both as environment
   variables, using those exact names. Save — Render redeploys automatically.
5. Check Render's **Logs** tab after it restarts — you should see:
   `💾 Using Upstash Redis — data will persist across redeploys.`
   If you instead see the warning about local file storage, the env vars
   weren't picked up — double-check the exact names and that you saved.

Without these two variables set, the app still works, but falls back to a
local JSON file that Render wipes on every deploy — fine for a quick local
test, not for the real thing.

## What's different from the Claude.ai artifact version

- Storage: real HTTP calls to `server.js` instead of `window.storage`.
- "Picking as" name memory is now `localStorage` (per-browser), which is
  legitimate here since this is a real hosted page, not a sandboxed artifact.
- New Field tab (season yardage visualization).
- Everything else — deadlines, admin game selection, the gold pot, drag-free
  click-to-pick — is unchanged.
