import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { openDatabase, runMigrations, type SqlDatabase } from '../src';

const factory = (f: string) => new Database(f) as unknown as SqlDatabase;

describe('Database Migrations', () => {
  it('applies initial schema and subsequent migrations idempotently', () => {
    const db = openDatabase({ filename: ':memory:', factory });

    // 1st run should apply migrations (001 initial, 002 bom & costing, 003 users security & system)
    const res1 = runMigrations(db);
    expect(res1.applied).toBe(3);

    // Verify core tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'inventory_movements', 'work_orders', 'recipes', 'recipe_items', 'work_centers')",
      )
      .all() as { name: string }[];
    expect(tables.length).toBe(6);

    // 2nd run should apply 0 migrations
    const res2 = runMigrations(db);
    expect(res2.applied).toBe(0);

    db.close();
  });
});
