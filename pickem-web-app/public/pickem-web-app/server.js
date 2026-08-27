// Tiny backend for the Pick 'Em web app.
// Provides a flat key-value store (backed by a JSON file) that the front-end
// talks to over HTTP, so state is genuinely shared across everyone who opens
// this page — and survives the page being bookmarked/opened from anywhere,
// unlike browser-only storage.

const express = require('express');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

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

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/kv/:key', (req, res) => {
  const db = loadDb();
  const key = req.params.key;
  if (!(key in db)) return res.status(404).json({ error: 'not found' });
  res.json({ key, value: db[key] });
});

app.put('/api/kv/:key', (req, res) => {
  const db = loadDb();
  db[req.params.key] = req.body.value;
  saveDb(db);
  res.json({ ok: true });
});

app.delete('/api/kv/:key', (req, res) => {
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
