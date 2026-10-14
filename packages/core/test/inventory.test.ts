import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fixedClock,
  openDatabase,
  runMigrations,
  sequentialIds,
  InventoryService,
  type SqlDatabase,
} from '../src';

const factory = (f: string) => new Database(f) as unknown as SqlDatabase;

describe('InventoryService (Append-Only Ledger)', () => {
  let db: SqlDatabase;
  let service: InventoryService;
  const clock = fixedClock('2026-10-14T08:00:00.000Z', 1000);
  const ids = sequentialIds('mov');
  const ctx = { actorId: 'usr-admin-1' };

  beforeEach(() => {
    db = openDatabase({ filename: ':memory:', factory });
    runMigrations(db);

    // Seed master data
    db.prepare("INSERT OR IGNORE INTO units_of_measure (code, name_ar, name_en, category) VALUES ('KG', 'كيلوغرام', 'Kilogram', 'MASS')").run();
    db.prepare("INSERT INTO items (id, code, name_ar, name_en, type, uom_code, cost_minor, reorder_point_scaled, created_at, updated_at) VALUES ('itm-1', 'RAW-TOM-01', 'طماطم', 'Tomato', 'RAW', 'KG', 1000, 500000, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z')").run();
    db.prepare("INSERT INTO locations (id, code, name_ar, name_en, type) VALUES ('loc-1', 'WH-MAIN', 'المستودع الرئيسي', 'Main Warehouse', 'WAREHOUSE')").run();
    db.prepare("INSERT INTO lots (id, lot_number, item_id, created_at) VALUES ('lot-1', 'LT-2610-01', 'itm-1', '2026-10-14T00:00:00Z')").run();

    service = new InventoryService(db, clock, ids);
  });

  it('records receipts and accumulates balance correctly', () => {
    // Receive 100.0000 KG (scaled to 1,000,000)
    service.recordMovement(ctx, {
      movementType: 'RECEIPT',
      itemId: 'itm-1',
      lotId: 'lot-1',
      locationId: 'loc-1',
      quantityScaled: 1_000_000,
      unitCostMinor: 1200, // 12.00 SAR
    });

    const balance = service.getBalance('itm-1', 'lot-1', 'loc-1');
    expect(balance).toBe(1_000_000n);

    // Check item cost updated
    const item = db.prepare('SELECT cost_minor FROM items WHERE id = ?').get('itm-1') as { cost_minor: number };
    expect(item.cost_minor).toBe(1200);
  });

  it('prevents negative stock consumption', () => {
    // Receive 50 KG
    service.recordMovement(ctx, {
      movementType: 'RECEIPT',
      itemId: 'itm-1',
      lotId: 'lot-1',
      locationId: 'loc-1',
      quantityScaled: 500_000,
    });

    // Try to issue 60 KG -> must throw
    expect(() =>
      service.recordMovement(ctx, {
        movementType: 'ISSUE',
        itemId: 'itm-1',
        lotId: 'lot-1',
        locationId: 'loc-1',
        quantityScaled: -600_000,
      }),
    ).toThrow(/Insufficient stock/);

    // Balance remains 50 KG
    expect(service.getBalance('itm-1')).toBe(500_000n);
  });

  it('atomically records audit and outbox entries', () => {
    service.recordMovement(ctx, {
      movementType: 'RECEIPT',
      itemId: 'itm-1',
      lotId: 'lot-1',
      locationId: 'loc-1',
      quantityScaled: 200_000,
      idempotencyKey: 'idem-test-1',
    });

    const audit = db.prepare("SELECT * FROM sys_audit_log WHERE action = 'inventory.movement.record'").all();
    expect(audit.length).toBe(1);

    const outbox = db.prepare("SELECT * FROM sys_outbox WHERE event_name = 'inventory.movement.created'").all();
    expect(outbox.length).toBe(1);
  });
});
