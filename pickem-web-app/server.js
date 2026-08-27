// Tiny backend for the Pick 'Em web app.
// Provides a flat key-value store (backed by a JSON file) that the front-end
// talks to over HTTP, so state is genuinely shared across everyone who opens
// this page — and survives the page being bookmarked/opened from anywhere,
// unlike browser-only storage.

try { require('dotenv').config(); } catch (e) { /* dotenv not installed — fine in production where real env vars are set */ }

const express = require('express');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveDb(db) {
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

// Front-end calls this to check a password before showing admin controls.
app.post('/api/admin-auth', (req, res) => {
  if (!ADMIN_PASSWORD) return res.json({ ok: true });
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get('/api/kv/:key', (req, res) => {
  const db = loadDb();
  const key = req.params.key;
  if (!(key in db)) return res.status(404).json({ error: 'not found' });
  res.json({ key, value: db[key] });
});

app.put('/api/kv/:key', (req, res, next) => {
  if (isAdminProtectedKey(req.params.key)) return checkAdminAuth(req, res, next);
  next();
}, (req, res) => {
  const db = loadDb();
  db[req.params.key] = req.body.value;
  saveDb(db);
  res.json({ ok: true });
});

app.delete('/api/kv/:key', (req, res, next) => {
  if (isAdminProtectedKey(req.params.key)) return checkAdminAuth(req, res, next);
  next();
}, (req, res) => {
  const db = loadDb();
  delete db[req.params.key];
  saveDb(db);
  res.json({ ok: true });
});

app.get('/api/kv-list', (req, res) => {
  const db = loadDb();
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
});
