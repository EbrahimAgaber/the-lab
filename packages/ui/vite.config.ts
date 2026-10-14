/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { openDatabase, runMigrations, CoreRpcDispatcher, systemClock, randomIds, type SqlDatabase } from '../core/src/index';

function labRpcPlugin(): Plugin {
  return {
    name: 'lab-rpc-plugin',
    configureServer(server) {
      const dataDir = path.resolve(process.cwd(), '.dev-data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, 'lab.db');
      const db = openDatabase({ filename: dbPath, factory: (f: string) => new Database(f) as unknown as SqlDatabase });
      runMigrations(db);
      const dispatcher = new CoreRpcDispatcher(db, systemClock, randomIds());

      server.middlewares.use('/rpc', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const token =
              (req.headers['x-session-token'] as string) ||
              req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
              payload.sessionToken;
            const resp = await dispatcher.dispatch(payload.method, payload.params, token);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(resp));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', messageKey: 'errors.invalidJson' } }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), labRpcPlugin()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: false,
  },
});
