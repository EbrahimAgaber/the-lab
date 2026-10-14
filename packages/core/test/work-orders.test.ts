import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  fixedClock,
  openDatabase,
  runMigrations,
  sequentialIds,
  InventoryService,
  WorkOrderService,
  type SqlDatabase,
} from '../src';

const factory = (f: string) => new Database(f) as unknown as SqlDatabase;

describe('WorkOrderService (Manufacturing Lifecycle)', () => {
  let db: SqlDatabase;
  let woService: WorkOrderService;
  let invService: InventoryService;
  const clock = fixedClock('2026-10-14T08:00:00.000Z', 1000);
  const ids = sequentialIds('wo');
  const ctx = { actorId: 'usr-supervisor' };

  beforeEach(() => {
    db = openDatabase({ filename: ':memory:', factory });
    runMigrations(db);

    // Seed master data
    db.prepare("INSERT INTO units_of_measure (code, name_ar, name_en, category) VALUES ('KG', 'كجم', 'Kilogram', 'MASS')").run();
    db.prepare("INSERT INTO units_of_measure (code, name_ar, name_en, category) VALUES ('PCS', 'قطعة', 'Pieces', 'COUNT')").run();

    // Raw Tomato & Finished Sauce
    db.prepare("INSERT INTO items (id, code, name_ar, name_en, type, uom_code, cost_minor, created_at, updated_at) VALUES ('itm-raw', 'RAW-TOM', 'طماطم', 'Tomato', 'RAW', 'KG', 200, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z')").run();
    db.prepare("INSERT INTO items (id, code, name_ar, name_en, type, uom_code, cost_minor, created_at, updated_at) VALUES ('itm-fg', 'FG-SAUCE', 'صلصة طماطم', 'Tomato Sauce', 'FINISHED', 'PCS', 1500, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z')").run();

    db.prepare("INSERT INTO locations (id, code, name_ar, name_en, type) VALUES ('loc-raw', 'LOC-RAW', 'مستودع المواد الخام', 'Raw Materials', 'WAREHOUSE')").run();
    db.prepare("INSERT INTO locations (id, code, name_ar, name_en, type) VALUES ('loc-fg', 'LOC-FG', 'مستودع المنتجات النهائية', 'Finished Goods', 'WAREHOUSE')").run();

    db.prepare("INSERT INTO lots (id, lot_number, item_id, created_at) VALUES ('lot-raw-1', 'LT-RAW-001', 'itm-raw', '2026-10-14T00:00:00Z')").run();
    db.prepare("INSERT INTO lots (id, lot_number, item_id, created_at) VALUES ('lot-fg-1', 'LT-FG-001', 'itm-fg', '2026-10-14T00:00:00Z')").run();

    invService = new InventoryService(db, clock, ids);
    woService = new WorkOrderService(db, clock, ids);

    // Initial stock receipt of 500 KG raw tomatoes
    invService.recordMovement(ctx, {
      movementType: 'RECEIPT',
      itemId: 'itm-raw',
      lotId: 'lot-raw-1',
      locationId: 'loc-raw',
      quantityScaled: 5_000_000, // 500.0000 KG
      unitCostMinor: 200,
    });
  });

  it('runs complete lifecycle: draft -> release -> in_progress -> consume -> complete', () => {
    // 1. Create Work Order
    const wo = woService.createWorkOrder(ctx, {
      orderNumber: 'WO-2026-001',
      itemId: 'itm-fg',
      plannedQuantityScaled: 1_000_000, // 100 finished units
      dueDate: '2026-10-20T12:00:00Z',
    });
    expect(wo.status).toBe('DRAFT');

    // 2. Release Work Order
    const released = woService.releaseWorkOrder(ctx, wo.id);
    expect(released.status).toBe('RELEASED');

    // 3. Start Work Order
    const inProgress = woService.startWorkOrder(ctx, wo.id);
    expect(inProgress.status).toBe('IN_PROGRESS');

    // 4. Record consumption: consume 200 KG of raw tomatoes
    woService.recordConsumption(ctx, {
      workOrderId: wo.id,
      itemId: 'itm-raw',
      lotId: 'lot-raw-1',
      locationId: 'loc-raw',
      quantityScaled: 2_000_000,
      unitCostMinor: 200,
    });

    // Check remaining raw balance is 300 KG
    expect(invService.getBalance('itm-raw')).toBe(3_000_000n);

    // 5. Complete Work Order (Yield 98 units, Scrap 2 units)
    const completed = woService.completeWorkOrder(ctx, wo.id, {
      yieldQuantityScaled: 980_000, // 98.0000
      scrapQuantityScaled: 20_000, // 2.0000
      targetLotId: 'lot-fg-1',
      targetLocationId: 'loc-fg',
      unitCostMinor: 1500,
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.yield_quantity_scaled).toBe(980_000);
    expect(completed.scrap_quantity_scaled).toBe(20_000);

    // Verify finished stock balance is now 98 units
    expect(invService.getBalance('itm-fg', 'lot-fg-1', 'loc-fg')).toBe(980_000n);
  });
});
