import { describe, expect, it, beforeEach } from 'vitest';
import { PersistentLabClient, SEED_DATA } from '../src/api/client';

describe('PersistentLabClient in-memory & persistence operations', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    // Polyfill localStorage mock
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: storageMock,
      writable: true,
    });
  });

  it('initializes with seed data when localStorage is empty', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');
    const items = await client.items.list();
    expect(items.length).toBe(SEED_DATA.items.length);
    expect(mockStorage['test.the-lab.v1']).toBeDefined();
  });

  it('supports full CRUD on items master', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');

    // Create item
    const created = await client.items.create({
      code: 'RAW-ALUM-FOIL',
      name_ar: 'رقائق ألومنيوم غذائية',
      name_en: 'Food Grade Aluminum Foil',
      type: 'PACKAGING',
      uom_code: 'ROLL',
      cost_minor: 1550,
      reorder_point_scaled: 500000,
    });
    expect(created.code).toBe('RAW-ALUM-FOIL');

    // Duplicate rejection
    await expect(
      client.items.create({
        code: 'raw-alum-foil',
        name_ar: 'تكرار',
        name_en: 'Duplicate',
        type: 'PACKAGING',
        uom_code: 'ROLL',
      }),
    ).rejects.toThrow(/already exists/);

    // Get item
    const fetched = await client.items.get(created.id);
    expect(fetched?.name_en).toBe('Food Grade Aluminum Foil');

    // Update item
    const updated = await client.items.update(created.id, {
      cost_minor: 1600,
    });
    expect(updated.cost_minor).toBe(1600);

    // Delete item
    const res = await client.items.delete(created.id);
    expect(res.deleted).toBe(true);

    const recheck = await client.items.get(created.id);
    expect(recheck).toBeNull();
  });

  it('supports full CRUD on work centers', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');

    const created = await client.workCenters.create({
      code: 'WC-PACK-AUTO',
      name_ar: 'محطة التعبئة والتغليف الآلية',
      name_en: 'Automated Packing Cell',
      industry_vertical: 'GENERAL',
      labor_rate_minor: 2500,
      overhead_rate_minor: 4000,
      capacity_per_hour_scaled: 2000000,
    });
    expect(created.code).toBe('WC-PACK-AUTO');

    const list = await client.workCenters.list('GENERAL');
    expect(list.some((w) => w.code === 'WC-PACK-AUTO')).toBe(true);

    const updated = await client.workCenters.update(created.id, {
      labor_rate_minor: 2800,
    });
    expect(updated.labor_rate_minor).toBe(2800);

    const del = await client.workCenters.delete(created.id);
    expect(del.deleted).toBe(true);
  });

  it('supports recipes lifecycle and cost calculation', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');
    const recipes = await client.recipes.list();
    expect(recipes.length).toBeGreaterThan(0);

    const first = recipes[0];
    expect(first).toBeDefined();
    if (!first) return;
    const cost = await client.recipes.calculateCost(first.id, first.base_quantity_scaled);
    expect(cost.totalBatchCostMinor).toBeGreaterThan(0);
    expect(cost.unitCostMinor).toBeGreaterThan(0);
    expect(cost.itemsCost.length).toBe(first.items.length);
  });

  it('manages work order lifecycle: create -> release -> start -> complete & cancel', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');

    // Create
    const wo = await client.workOrders.create({
      orderNumber: 'WO-2026-TEST-01',
      itemId: 'itm-tomato-paste-800g',
      plannedQuantityScaled: 5000000,
      dueDate: '2026-10-30T10:00:00Z',
      notes: 'Test Work Order',
    });
    expect(wo.status).toBe('DRAFT');

    // Release
    const released = await client.workOrders.release(wo.id);
    expect(released.status).toBe('RELEASED');

    // Start
    const started = await client.workOrders.start(wo.id);
    expect(started.status).toBe('IN_PROGRESS');

    // Complete
    const completed = await client.workOrders.complete(wo.id, {
      yieldQuantityScaled: 4800000,
      scrapQuantityScaled: 200000,
      targetLotId: 'lot-test-fg-01',
      targetLocationId: 'loc-fg-main',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.yield_quantity_scaled).toBe(4800000);

    // Cancel draft work order
    const wo2 = await client.workOrders.create({
      orderNumber: 'WO-2026-TEST-02',
      itemId: 'itm-shirt-oxford-l',
      plannedQuantityScaled: 1000000,
      dueDate: '2026-10-31T10:00:00Z',
    });
    const cancelled = await client.workOrders.cancel(wo2.id, 'User cancelled');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.notes).toContain('CANCELLED: User cancelled');
  });

  it('manages inventory movements, non-negative balance enforcement, and lot QC updates', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');

    // Check balance
    const initialBal = await client.inventory.getBalance('itm-fresh-tomato');
    expect(BigInt(initialBal)).toBe(25000000n);

    // Negative stock check enforcement
    await expect(
      client.inventory.recordMovement({
        movementType: 'ISSUE',
        itemId: 'itm-fresh-tomato',
        lotId: 'lot-tom-01',
        locationId: 'loc-cold-room',
        quantityScaled: -30000000, // Exceeds 25,000,000
      }),
    ).rejects.toThrow(/Insufficient stock/);

    // Record valid issue
    await client.inventory.recordMovement({
      movementType: 'ISSUE',
      itemId: 'itm-fresh-tomato',
      lotId: 'lot-tom-01',
      locationId: 'loc-cold-room',
      quantityScaled: -5000000,
    });

    const afterBal = await client.inventory.getBalance('itm-fresh-tomato');
    expect(BigInt(afterBal)).toBe(20000000n);

    // Stock on hand breakdown
    const stockOnHand = await client.inventory.getStockOnHand('itm-fresh-tomato');
    expect(stockOnHand.length).toBe(1);
    expect(stockOnHand[0]?.totalQuantityScaled).toBe(20000000);

    // QC Status update
    const updatedLot = await client.inventory.updateLotQc('lot-tom-01', 'REJECTED');
    expect(updatedLot.qc_status).toBe('REJECTED');
  });

  it('system backup: export, import, reset to empty, seed default data', async () => {
    const client = new PersistentLabClient('test.the-lab.v1');

    // Export
    const backup = client.system.exportData();
    expect(backup.items.length).toBeGreaterThan(0);

    // Reset to empty
    client.system.resetToEmpty();
    const emptyItems = await client.items.list();
    expect(emptyItems.length).toBe(0);

    // Import back
    client.system.importData(backup);
    const restoredItems = await client.items.list();
    expect(restoredItems.length).toBe(backup.items.length);

    // Seed default data
    client.system.resetToEmpty();
    client.system.seedDefaultData();
    const seededAgain = await client.items.list();
    expect(seededAgain.length).toBe(SEED_DATA.items.length);
  });
});
