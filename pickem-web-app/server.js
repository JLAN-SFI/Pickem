// Tiny backend for the Pick 'Em web app.
// Provides a flat key-value store that the front-end talks to over HTTP, so
// state is genuinely shared across everyone who opens this page.
//
// Storage: uses Upstash Redis (free, persists forever) when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set. Falls back to a
// local JSON file when they're not — handy for local dev, but NOT persistent
// on hosts like Render where the filesystem resets on every redeploy. Set
// the Upstash env vars before sharing the real URL with your team.

try { require('dotenv').config(); } catch (e) { /* dotenv not installed — fine in production where real env vars are set */ }

const express = require('express');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || null;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || null;
const REDIS_KEY = 'pickem-db';
const usingRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

async function loadDb() {
  if (usingRedis) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`Upstash GET failed (${res.status}): ${text}`);
        return {};
      }
      const data = await res.json();
      if (data && data.result) return JSON.parse(data.result);
      return {};
    } catch (e) {
      console.error('Upstash load failed:', e.message);
      return {};
    }
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

async function saveDb(db) {
  if (usingRedis) {
    try {
      const res = await fetch(`${UPSTASH_URL}/set/${REDIS_KEY}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        body: JSON.stringify(db)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`Upstash SET failed (${res.status}): ${text}`);
      }
    } catch (e) {
      console.error('Upstash save failed:', e.message);
    }
    return;
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Only the keys admin mode writes to (this week's game selection/deadline,
// and the prize pot base amount) require the password. Picks and the member
// list stay open so everyone can keep using the app normally.
function isAdminProtectedKey(key) {
  return key === 'prize-config' || key.startsWith('slate-');
}

function checkAdminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) return next(); // no password configured — leave open
  const provided = req.header('x-admin-password');
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Visit this in a browser to see exactly what's happening with storage —
// whether Upstash env vars are set, and whether a real write/read actually
// round-trips successfully. No secrets are exposed in the response.
app.get('/api/debug-storage', async (req, res) => {
  const info = {
    usingRedis,
    upstashUrlSet: !!UPSTASH_URL,
    upstashTokenSet: !!UPSTASH_TOKEN
  };
  if (!usingRedis) {
    info.note = 'Not using Upstash — either the env vars are missing, or one of them is empty. Data is using local file storage, which Render wipes on redeploy.';
    return res.json(info);
  }
  try {
    const testKey = 'debug-roundtrip-test';
    const testValue = { ts: Date.now() };

    const setRes = await fetch(`${UPSTASH_URL}/set/${testKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(testValue)
    });
    info.setStatus = setRes.status;
    info.setBody = await setRes.text().catch(() => '(could not read body)');

    // Immediate read — checks basic read/write correctness.
    const getResImmediate = await fetch(`${UPSTASH_URL}/get/${testKey}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const getJsonImmediate = await getResImmediate.json().catch(() => null);
    info.immediateGetResult = getJsonImmediate;
    info.immediateRoundTripSuccess = !!(getJsonImmediate && getJsonImmediate.result && JSON.parse(getJsonImmediate.result).ts === testValue.ts);

    // Delayed read (1.5s) — if this succeeds but the immediate one didn't,
    // that's replication lag on a Global (multi-region) Upstash database,
    // not a config problem.
    await new Promise(r => setTimeout(r, 1500));
    const getResDelayed = await fetch(`${UPSTASH_URL}/get/${testKey}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const getJsonDelayed = await getResDelayed.json().catch(() => null);
    info.delayedGetResult = getJsonDelayed;
    info.delayedRoundTripSuccess = !!(getJsonDelayed && getJsonDelayed.result && JSON.parse(getJsonDelayed.result).ts === testValue.ts);
  } catch (e) {
    info.error = e.message;
  }
  res.json(info);
});

// Front-end calls this to check a password before showing admin controls.
app.post('/api/admin-auth', (req, res) => {
  if (!ADMIN_PASSWORD) return res.json({ ok: true });
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get('/api/kv/:key', async (req, res) => {
  const db = await loadDb();
  const key = req.params.key;
  if (!(key in db)) return res.status(404).json({ error: 'not found' });
  res.json({ key, value: db[key] });
});

app.put('/api/kv/:key', (req, res, next) => {
  if (isAdminProtectedKey(req.params.key)) return checkAdminAuth(req, res, next);
  next();
}, async (req, res) => {
  const db = await loadDb();
  db[req.params.key] = req.body.value;
  await saveDb(db);
  res.json({ ok: true });
});

app.delete('/api/kv/:key', (req, res, next) => {
  if (isAdminProtectedKey(req.params.key)) return checkAdminAuth(req, res, next);
  next();
}, async (req, res) => {
  const db = await loadDb();
  delete db[req.params.key];
  await saveDb(db);
  res.json({ ok: true });
});

app.get('/api/kv-list', async (req, res) => {
  const db = await loadDb();
  const prefix = req.query.prefix || '';
  const keys = Object.keys(db).filter(k => k.startsWith(prefix));
  res.json({ keys });
});

// Anything else (including the bare root) serves the app itself.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pickem.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🏈 Pick 'Em running at http://localhost:${port}`);
  console.log(usingRedis
    ? '💾 Using Upstash Redis — data will persist across redeploys.'
    : '⚠️  No Upstash env vars set — using local file storage, which will be WIPED on every Render redeploy.');
  console.log(ADMIN_PASSWORD
    ? '🔒 ADMIN_PASSWORD is set — Admin mode is password-protected.'
    : '⚠️  No ADMIN_PASSWORD env var detected — Admin mode is currently OPEN to anyone.');
});
