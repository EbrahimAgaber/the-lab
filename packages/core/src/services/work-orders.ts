import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { AuditService, type AuditContext } from './audit';
import { InventoryService } from './inventory';

export type WorkOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CreateWorkOrderDto {
  orderNumber: string;
  itemId: string;
  targetLotId?: string;
  plannedQuantityScaled: number; // 4 decimals scale (10,000)
  dueDate: string;
  notes?: string;
}

export interface WorkOrderRecord {
  id: string;
  order_number: string;
  item_id: string;
  target_lot_id: string | null;
  planned_quantity_scaled: number;
  yield_quantity_scaled: number;
  scrap_quantity_scaled: number;
  status: WorkOrderStatus;
  qc_status: string;
  due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumeMaterialDto {
  workOrderId: string;
  itemId: string;
  lotId: string;
  locationId: string;
  quantityScaled: number;
  unitCostMinor?: number;
}

export class WorkOrderService {
  private audit: AuditService;
  private inventory: InventoryService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.audit = new AuditService(db, clock, ids);
    this.inventory = new InventoryService(db, clock, ids);
  }

  createWorkOrder(ctx: AuditContext, dto: CreateWorkOrderDto): WorkOrderRecord {
    const id = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO work_orders (
            id, order_number, item_id, target_lot_id, planned_quantity_scaled,
            yield_quantity_scaled, scrap_quantity_scaled, status, qc_status,
            due_date, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, 0, 'DRAFT', 'QUARANTINE', ?, ?, ?, ?)`,
        )
        .run(
          id,
          dto.orderNumber,
          dto.itemId,
          dto.targetLotId ?? null,
          dto.plannedQuantityScaled,
          dto.dueDate,
          dto.notes ?? null,
          now,
          now,
        );

      this.audit.logAudit(ctx, {
        action: 'work_order.create',
        entityType: 'work_order',
        entityId: id,
        diff: { orderNumber: dto.orderNumber, status: 'DRAFT', plannedQuantity: dto.plannedQuantityScaled },
      });

      return this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord;
    });

    return tx();
  }

  releaseWorkOrder(ctx: AuditContext, id: string): WorkOrderRecord {
    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      const wo = this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord | undefined;
      if (!wo) throw new Error(`Work order ${id} not found`);
      if (wo.status !== 'DRAFT') throw new Error(`Cannot release work order in status ${wo.status}`);

      this.db.prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?').run('RELEASED', now, id);

      this.audit.logAudit(ctx, {
        action: 'work_order.release',
        entityType: 'work_order',
        entityId: id,
        diff: { from: 'DRAFT', to: 'RELEASED' },
      });

      return this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord;
    });

    return tx();
  }

  startWorkOrder(ctx: AuditContext, id: string): WorkOrderRecord {
    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      const wo = this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord | undefined;
      if (!wo) throw new Error(`Work order ${id} not found`);
      if (wo.status !== 'RELEASED') throw new Error(`Cannot start work order in status ${wo.status}`);

      this.db.prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?').run('IN_PROGRESS', now, id);

      this.audit.logAudit(ctx, {
        action: 'work_order.start',
        entityType: 'work_order',
        entityId: id,
        diff: { from: 'RELEASED', to: 'IN_PROGRESS' },
      });

      return this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord;
    });

    return tx();
  }

  recordConsumption(ctx: AuditContext, dto: ConsumeMaterialDto): void {
    const tx = this.db.transaction(() => {
      const wo = this.db
        .prepare('SELECT * FROM work_orders WHERE id = ?')
        .get(dto.workOrderId) as WorkOrderRecord | undefined;
      if (!wo) throw new Error(`Work order ${dto.workOrderId} not found`);
      if (wo.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot consume materials for work order in status ${wo.status}`);
      }

      // Deduct raw material from ledger
      this.inventory.recordMovement(ctx, {
        movementType: 'PRODUCTION_CONSUME',
        itemId: dto.itemId,
        lotId: dto.lotId,
        locationId: dto.locationId,
        quantityScaled: -Math.abs(dto.quantityScaled),
        unitCostMinor: dto.unitCostMinor,
        referenceType: 'WORK_ORDER',
        referenceId: dto.workOrderId,
      });

      // Record consumption line
      const cid = this.ids.next();
      this.db
        .prepare(
          `INSERT INTO work_order_consumptions (
            id, work_order_id, item_id, lot_id, location_id, quantity_scaled, unit_cost_minor, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          cid,
          dto.workOrderId,
          dto.itemId,
          dto.lotId,
          dto.locationId,
          dto.quantityScaled,
          dto.unitCostMinor ?? 0,
          this.clock.now().toISOString(),
        );
    });

    tx();
  }

  completeWorkOrder(
    ctx: AuditContext,
    id: string,
    params: {
      yieldQuantityScaled: number;
      scrapQuantityScaled: number;
      targetLotId: string;
      targetLocationId: string;
      scrapLocationId?: string;
      unitCostMinor?: number;
    },
  ): WorkOrderRecord {
    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      const wo = this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord | undefined;
      if (!wo) throw new Error(`Work order ${id} not found`);
      if (wo.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot complete work order in status ${wo.status}`);
      }

      // Record production yield in inventory ledger
      if (params.yieldQuantityScaled > 0) {
        this.inventory.recordMovement(ctx, {
          movementType: 'PRODUCTION_YIELD',
          itemId: wo.item_id,
          lotId: params.targetLotId,
          locationId: params.targetLocationId,
          quantityScaled: params.yieldQuantityScaled,
          unitCostMinor: params.unitCostMinor,
          referenceType: 'WORK_ORDER',
          referenceId: id,
        });
      }

      // Record scrap if any (negative or scrap location)
      // Scrap is recorded as scrap movement; if targetLocationId is passed, it is discarded, not added to usable stock
      if (params.scrapQuantityScaled > 0 && params.scrapLocationId) {
        this.inventory.recordMovement(ctx, {
          movementType: 'SCRAP',
          itemId: wo.item_id,
          lotId: params.targetLotId,
          locationId: params.scrapLocationId,
          quantityScaled: params.scrapQuantityScaled,
          unitCostMinor: params.unitCostMinor,
          referenceType: 'WORK_ORDER',
          referenceId: id,
        });
      }

      this.db
        .prepare(
          `UPDATE work_orders SET
            status = 'COMPLETED',
            yield_quantity_scaled = ?,
            scrap_quantity_scaled = ?,
            target_lot_id = ?,
            updated_at = ?
          WHERE id = ?`,
        )
        .run(params.yieldQuantityScaled, params.scrapQuantityScaled, params.targetLotId, now, id);

      this.audit.logAudit(ctx, {
        action: 'work_order.complete',
        entityType: 'work_order',
        entityId: id,
        diff: {
          from: 'IN_PROGRESS',
          to: 'COMPLETED',
          yieldQuantity: params.yieldQuantityScaled,
          scrapQuantity: params.scrapQuantityScaled,
        },
      });

      this.audit.emitOutbox({
        eventName: 'production.completed',
        aggregateType: 'work_order',
        aggregateId: id,
        payload: {
          workOrderId: id,
          orderNumber: wo.order_number,
          yieldQuantity: params.yieldQuantityScaled,
          scrapQuantity: params.scrapQuantityScaled,
        },
      });

      return this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrderRecord;
    });

    return tx();
  }

  listWorkOrders(status?: WorkOrderStatus): WorkOrderRecord[] {
    let query = 'SELECT * FROM work_orders';
    const params: unknown[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';

    return this.db.prepare(query).all(...params) as WorkOrderRecord[];
  }
}
