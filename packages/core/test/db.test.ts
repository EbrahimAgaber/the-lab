import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock, openDatabase, sequentialIds, type SqlDatabase } from '../src';

const factory = (f: string) => new Database(f) as unknown as SqlDatabase;

describe('openDatabase', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('opens a file database in WAL mode with foreign keys on', () => {
    dir = mkdtempSync(join(tmpdir(), 'lab-'));
    const db = openDatabase({ filename: join(dir, 'lab.db'), factory });
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('rolls back a transaction completely when it throws', () => {
    const db = openDatabase({ filename: ':memory:', factory });
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run('a');
      throw new Error('boom');
    });
    expect(() => tx()).toThrow('boom');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 0 });
    db.close();
  });
});

describe('injected runtime', () => {
  it('fixedClock is deterministic and steps', () => {
    const c = fixedClock('2026-01-01T00:00:00.000Z', 1000);
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
  });

  it('sequentialIds is deterministic', () => {
    const ids = sequentialIds('mv');
    expect([ids.next(), ids.next()]).toEqual(['mv-000001', 'mv-000002']);
  });
});
