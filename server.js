const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20kb' }));
const online = new Map();
const TTL = 90000;
const DATA_FILE = process.env.LAIN_REGISTRY_DATA_FILE || path.join(__dirname, 'data', 'cosmetics.json');
const cosmetics = new Map();
const VALID_NICK = /^[A-Za-z0-9_]{3,16}$/;
const VALID_STYLES = new Set(['ANGEL', 'DEMON', 'CYBER']);

function loadCosmetics() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const [nick, value] of Object.entries(parsed)) {
      if (VALID_NICK.test(nick) && value && typeof value.enabled === 'boolean' && VALID_STYLES.has(value.style)) {
        cosmetics.set(nick.toLowerCase(), { nick, enabled: value.enabled, style: value.style, updatedAt: value.updatedAt || Date.now() });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not load cosmetics store:', err.message);
  }
}
let saveQueue = Promise.resolve();
function persistCosmetics() {
  const snapshot = Object.fromEntries([...cosmetics.entries()].map(([key, value]) => [key, value]));
  saveQueue = saveQueue.then(async () => {
    await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.tmp`;
    await fs.promises.writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8');
    await fs.promises.rename(temp, DATA_FILE);
  }).catch(err => console.error('Could not persist cosmetics:', err.message));
  return saveQueue;
}
loadCosmetics();

app.get('/', (req, res) => res.send('ok'));
app.post('/heartbeat', (req, res) => {
  const nick = String(req.body.nick || '').trim();
  if (!VALID_NICK.test(nick)) return res.status(400).json({ error: 'invalid_nick' });
  online.set(nick.toLowerCase(), Date.now());
  res.sendStatus(200);
});
app.post('/check', (req, res) => {
  const names = Array.isArray(req.body.names) ? req.body.names.slice(0, 200) : [];
  const now = Date.now();
  res.json(names.filter(n => {
    const t = online.get(String(n).toLowerCase());
    return t && now - t < TTL;
  }));
});

// Get cosmetics for a set of player names: GET /cosmetics?names=Steve,Alex
app.get('/cosmetics', (req, res) => {
  const names = String(req.query.names || '').split(',').slice(0, 200);
  const result = {};
  for (const raw of names) {
    const nick = raw.trim();
    if (!VALID_NICK.test(nick)) continue;
    const item = cosmetics.get(nick.toLowerCase());
    if (item) result[nick.toLowerCase()] = { nick: item.nick, enabled: item.enabled, style: item.style, updatedAt: item.updatedAt };
  }
  res.set('Cache-Control', 'no-store').json({ cosmetics: result });
});

// Save preferences for the caller's nickname. Client currently has no authentication,
// so this endpoint must only be used on a trusted/private registry until auth is added.
app.put('/cosmetics/:nick', async (req, res) => {
  const nick = String(req.params.nick || '').trim();
  if (!VALID_NICK.test(nick)) return res.status(400).json({ error: 'invalid_nick' });
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'enabled_must_be_boolean' });
  const style = String(req.body.style || '').toUpperCase();
  if (!VALID_STYLES.has(style)) return res.status(400).json({ error: 'invalid_style', allowed: [...VALID_STYLES] });
  const entry = { nick, enabled: req.body.enabled, style, updatedAt: Date.now() };
  cosmetics.set(nick.toLowerCase(), entry);
  await persistCosmetics();
  res.json({ ok: true, cosmetic: entry });
});

setInterval(() => {
  const now = Date.now();
  for (const [k, t] of online) if (now - t > TTL) online.delete(k);
}, 30000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Lain registry started on ${port}; cosmetics store: ${DATA_FILE}`));
