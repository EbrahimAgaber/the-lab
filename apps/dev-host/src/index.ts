import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase, runMigrations, CoreRpcDispatcher, systemClock, randomIds } from '@the-lab/core';

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.resolve(process.cwd(), '.dev-data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (process.argv.includes('--fresh')) {
  const dbFile = path.join(DATA_DIR, 'lab.db');
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log('[dev-host] Wiped existing database (--fresh flag provided)');
  }
}

const dbPath = path.join(DATA_DIR, 'lab.db');
const db = openDatabase({ filename: dbPath, factory: (f) => new Database(f) });
runMigrations(db);

const dispatcher = new CoreRpcDispatcher(db, systemClock, randomIds());

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const token =
          (req.headers['x-session-token'] as string) ||
          req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
          payload.sessionToken;

        const response = await dispatcher.dispatch(payload.method, payload.params, token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', messageKey: 'errors.invalidJson' } }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-host] The Lab RPC host running at http://0.0.0.0:${PORT}/rpc`);
});
