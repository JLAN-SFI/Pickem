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

## Data storage

Data lives in `data/db.json` on the server, created automatically on first
write. This is intentionally simple and fine for a small office pool.

One thing worth knowing: on some hosts (e.g. Render's free tier), the
filesystem resets on redeploys — data persists across restarts of the same
running instance, but a fresh deploy wipes it. If that matters to you, either
attach a persistent disk (a paid feature on most hosts) or swap `server.js`'s
`loadDb()`/`saveDb()` for a real database — everything else in the app is
agnostic to how storage works underneath.

## What's different from the Claude.ai artifact version

- Storage: real HTTP calls to `server.js` instead of `window.storage`.
- "Picking as" name memory is now `localStorage` (per-browser), which is
  legitimate here since this is a real hosted page, not a sandboxed artifact.
- New Field tab (season yardage visualization).
- Everything else — deadlines, admin game selection, the gold pot, drag-free
  click-to-pick — is unchanged.
