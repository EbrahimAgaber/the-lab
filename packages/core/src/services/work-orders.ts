import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { AuditService, type AuditContext } from './audit';
import { InventoryService } from './inventory';
import type {
  AddConsumptionDto,
  CompleteWorkOrderDto,
  CreateWorkOrderDto,
  WorkOrderConsumptionRecord,
  WorkOrderRow,
  WorkOrderStatus,
} from '@the-lab/contract';
import { RpcError } from '@the-lab/contract';

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

  private generateOrderNumber(): string {
    const seq = this.db
      .prepare('SELECT prefix, next_val, padding FROM number_sequences WHERE doc_type = ?')
      .get('WORK_ORDER') as { prefix: string; next_val: number; padding: number } | undefined;

    if (!seq) {
      return `WO-${Date.now().toString().slice(-6)}`;
    }

    const padded = String(seq.next_val).padStart(seq.padding, '0');
    const orderNum = `${seq.prefix}${padded}`;

    this.db
      .prepare('UPDATE number_sequences SET next_val = next_val + 1 WHERE doc_type = ?')
      .run('WORK_ORDER');

    return orderNum;
  }

  public listWorkOrders(status?: WorkOrderStatus): WorkOrderRow[] {
    let query = `
      SELECT w.id, w.order_number, w.item_id, w.recipe_id, w.target_lot_id,
             w.planned_quantity_scaled, w.yield_quantity_scaled, w.scrap_quantity_scaled,
             w.status, w.qc_status, w.due_date, w.notes, w.created_at, w.updated_at,
             i.name_ar as item_name_ar, i.name_en as item_name_en,
             l.lot_number
      FROM work_orders w
      LEFT JOIN items i ON w.item_id = i.id
      LEFT JOIN lots l ON w.target_lot_id = l.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (status) {
      query += ` AND w.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY w.created_at DESC`;

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapWorkOrderRow(r));
  }

  public getWorkOrder(id: string): WorkOrderRow | null {
    const r = this.db
      .prepare(
        `SELECT w.id, w.order_number, w.item_id, w.recipe_id, w.target_lot_id,
                w.planned_quantity_scaled, w.yield_quantity_scaled, w.scrap_quantity_scaled,
                w.status, w.qc_status, w.due_date, w.notes, w.created_at, w.updated_at,
                i.name_ar as item_name_ar, i.name_en as item_name_en,
                l.lot_number
         FROM work_orders w
         LEFT JOIN items i ON w.item_id = i.id
         LEFT JOIN lots l ON w.target_lot_id = l.id
         WHERE w.id = ? OR w.order_number = ?`,
      )
      .get(id, id) as Record<string, unknown> | undefined;

    return r ? this.mapWorkOrderRow(r) : null;
  }

  public createWorkOrder(ctx: AuditContext, dto: CreateWorkOrderDto): WorkOrderRow {
    const id = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      const orderNumber = dto.orderNumber?.trim() || this.generateOrderNumber();

      this.db
        .prepare(
          `INSERT INTO work_orders (
             id, order_number, item_id, recipe_id, target_lot_id, planned_quantity_scaled,
             yield_quantity_scaled, scrap_quantity_scaled, status, qc_status,
             due_date, notes, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'DRAFT', 'QUARANTINE', ?, ?, ?, ?)`,
        )
        .run(
          id,
          orderNumber,
          dto.itemId,
          dto.recipeId || null,
          dto.targetLotId || null,
          dto.plannedQuantityScaled,
          dto.dueDate,
          dto.notes || null,
          now,
          now,
        );

      this.audit.record({
        actorId: ctx.actorId,
        action: 'work_orders.created',
        entityType: 'work_orders',
        entityId: id,
        diff: { orderNumber, plannedQuantity: dto.plannedQuantityScaled },
      });
    });

    tx();
    return this.getWorkOrder(id)!;
  }

  public releaseWorkOrder(ctx: AuditContext, id: string): WorkOrderRow {
    const current = this.getWorkOrder(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.workOrderNotFound', `Work order ${id} not found.`);
    if (current.status !== 'DRAFT') {
      throw new RpcError('CONFLICT', 'errors.cannotReleaseWorkOrder', `Cannot release work order in status ${current.status}.`);
    }

    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?').run('RELEASED', now, id);

      this.audit.record({
        actorId: ctx.actorId,
        action: 'work_orders.released',
        entityType: 'work_orders',
        entityId: id,
        diff: { from: 'DRAFT', to: 'RELEASED' },
      });
    });

    tx();
    return this.getWorkOrder(id)!;
  }

  public startWorkOrder(ctx: AuditContext, id: string): WorkOrderRow {
    const current = this.getWorkOrder(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.workOrderNotFound', `Work order ${id} not found.`);
    if (current.status !== 'RELEASED') {
      throw new RpcError('CONFLICT', 'errors.cannotStartWorkOrder', `Cannot start work order in status ${current.status}.`);
    }

    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?').run('IN_PROGRESS', now, id);

      this.audit.record({
        actorId: ctx.actorId,
        action: 'work_orders.started',
        entityType: 'work_orders',
        entityId: id,
        diff: { from: 'RELEASED', to: 'IN_PROGRESS' },
      });
    });

    tx();
    return this.getWorkOrder(id)!;
  }

  public completeWorkOrder(ctx: AuditContext, id: string, params: CompleteWorkOrderDto): WorkOrderRow {
    const current = this.getWorkOrder(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.workOrderNotFound', `Work order ${id} not found.`);
    if (current.status !== 'IN_PROGRESS') {
      throw new RpcError('CONFLICT', 'errors.cannotCompleteWorkOrder', `Cannot complete work order in status ${current.status}.`);
    }

    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      // 1. Create Output Finished Goods Lot if needed
      let targetLotId = params.targetLotId || current.target_lot_id;
      if (!targetLotId) {
        targetLotId = this.ids.next();
        const lotNumber = `LT-WO-${current.order_number.replace(/^WO-/, '')}`;
        this.db
          .prepare(
            `INSERT INTO lots (id, lot_number, item_id, qc_status, created_at)
             VALUES (?, ?, ?, 'QUARANTINE', ?)`,
          )
          .run(targetLotId, lotNumber, current.item_id, now);
      }

      let targetLocationId = params.targetLocationId;
      if (!targetLocationId) {
        const defaultLoc = this.db.prepare('SELECT id FROM locations LIMIT 1').get() as { id: string } | undefined;
        targetLocationId = defaultLoc?.id || 'loc-raw-main';
      }

      // 2. Record Production Yield Movement
      if (params.yieldQuantityScaled > 0) {
        this.inventory.recordMovement(ctx, {
          movementType: 'PRODUCTION_YIELD',
          itemId: current.item_id,
          lotId: targetLotId,
          locationId: targetLocationId,
          quantityScaled: params.yieldQuantityScaled,
          unitCostMinor: params.unitCostMinor,
          referenceType: 'WORK_ORDER',
          referenceId: id,
        });
      }

      // 3. Record Scrap Movement if reported
      if (params.scrapQuantityScaled > 0) {
        const scrapLoc = this.db
          .prepare("SELECT id FROM locations WHERE type = 'SCRAP' OR id = 'loc-scrap-bay' LIMIT 1")
          .get() as { id: string } | undefined;
        const scrapLocationId = scrapLoc?.id || targetLocationId;

        this.inventory.recordMovement(ctx, {
          movementType: 'SCRAP',
          itemId: current.item_id,
          lotId: targetLotId,
          locationId: scrapLocationId,
          quantityScaled: params.scrapQuantityScaled,
          unitCostMinor: params.unitCostMinor,
          referenceType: 'WORK_ORDER',
          referenceId: id,
        });
      }

      // 4. Update Work Order Record
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
        .run(params.yieldQuantityScaled, params.scrapQuantityScaled, targetLotId, now, id);

      this.audit.record({
        actorId: ctx.actorId,
        action: 'work_orders.completed',
        entityType: 'work_orders',
        entityId: id,
        diff: {
          yieldQuantity: params.yieldQuantityScaled,
          scrapQuantity: params.scrapQuantityScaled,
          targetLotId,
        },
      });
    });

    tx();
    return this.getWorkOrder(id)!;
  }

  public cancelWorkOrder(ctx: AuditContext, id: string, reason?: string): WorkOrderRow {
    const current = this.getWorkOrder(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.workOrderNotFound', `Work order ${id} not found.`);
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new RpcError('CONFLICT', 'errors.cannotCancelWorkOrder', `Cannot cancel work order in status ${current.status}.`);
    }

    const now = this.clock.now().toISOString();
    const tx = this.db.transaction(() => {
      const updatedNotes = reason ? `${current.notes ? current.notes + ' | ' : ''}Cancelled: ${reason}` : current.notes;
      this.db
        .prepare('UPDATE work_orders SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
        .run('CANCELLED', updatedNotes, now, id);

      this.audit.record({
        actorId: ctx.actorId,
        action: 'work_orders.cancelled',
        entityType: 'work_orders',
        entityId: id,
        diff: { reason },
      });
    });

    tx();
    return this.getWorkOrder(id)!;
  }

  public recordConsumption(ctx: AuditContext, dto: AddConsumptionDto): WorkOrderConsumptionRecord {
    return this.addConsumption(ctx, dto);
  }

  public addConsumption(ctx: AuditContext, dto: AddConsumptionDto): WorkOrderConsumptionRecord {
    const wo = this.getWorkOrder(dto.workOrderId);
    if (!wo) throw new RpcError('NOT_FOUND', 'errors.workOrderNotFound', `Work order ${dto.workOrderId} not found.`);
    if (wo.status !== 'IN_PROGRESS') {
      throw new RpcError('CONFLICT', 'errors.mustBeInProgress', `Work order must be IN_PROGRESS to record material consumption.`);
    }

    const cid = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      // 1. Inventory consumption movement (negative delta)
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

      // 2. Work order consumption line record
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
          now,
        );
    });

    tx();

    return {
      id: cid,
      work_order_id: dto.workOrderId,
      item_id: dto.itemId,
      lot_id: dto.lotId,
      location_id: dto.locationId,
      quantity_scaled: dto.quantityScaled,
      unit_cost_minor: dto.unitCostMinor ?? 0,
      recorded_at: now,
    };
  }

  private mapWorkOrderRow(r: Record<string, unknown>): WorkOrderRow {
    const itemName = r.item_name_ar ? `${String(r.item_name_ar)} (${String(r.item_name_en || '')})` : undefined;
    return {
      id: String(r.id),
      order_number: String(r.order_number),
      item_id: String(r.item_id),
      item_name: itemName,
      recipe_id: r.recipe_id ? String(r.recipe_id) : null,
      target_lot_id: r.target_lot_id ? String(r.target_lot_id) : null,
      lot_number: r.lot_number ? String(r.lot_number) : undefined,
      planned_quantity_scaled: Number(r.planned_quantity_scaled),
      yield_quantity_scaled: Number(r.yield_quantity_scaled || 0),
      scrap_quantity_scaled: Number(r.scrap_quantity_scaled || 0),
      status: r.status as WorkOrderStatus,
      qc_status: String(r.qc_status || 'QUARANTINE'),
      due_date: String(r.due_date),
      notes: r.notes ? String(r.notes) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
