/**
 * Minimal structural interface of the SQLite driver the core needs.
 * The concrete driver (better-sqlite3) is injected by the host (tests, Electron main),
 * so the core never imports a native module itself.
 */
export interface SqlStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  exec(sql: string): unknown;
  pragma(source: string, options?: { simple?: boolean }): unknown;
  transaction<F extends (...args: never[]) => unknown>(fn: F): F;
  close(): unknown;
}

export type DatabaseFactory = (filename: string) => SqlDatabase;

export interface OpenOptions {
  filename: string;
  factory: DatabaseFactory;
}

/** Opens a database with the pragmas The Lab relies on (WAL, FK enforcement). */
export function openDatabase({ filename, factory }: OpenOptions): SqlDatabase {
  const db = factory(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}
