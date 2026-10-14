import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { AuditService, type AuditContext } from './audit';
import type {
  CreateItemDto,
  CreateWorkCenterDto,
  IndustryVertical,
  ItemDto,
  ItemType,
  LocationDto,
  SupplierDto,
  UpdateItemDto,
  UpdateWorkCenterDto,
  WorkCenterDto,
} from '@the-lab/contract';
import { RpcError } from '@the-lab/contract';

export class CatalogService {
  private audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.audit = new AuditService(db, clock, ids);
  }

  // --- ITEMS MASTER ---
  public listItems(filter?: { type?: ItemType; isActive?: boolean }): ItemDto[] {
    let query = `
      SELECT id, code, name_ar, name_en, type, uom_code, cost_minor, selling_price_minor,
             reorder_point_scaled, barcode, shelf_life_days, lot_tracked, expiry_tracked,
             is_active, created_at, updated_at
      FROM items
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filter?.type) {
      query += ` AND type = ?`;
      params.push(filter.type);
    }
    if (filter?.isActive !== undefined) {
      query += ` AND is_active = ?`;
      params.push(filter.isActive ? 1 : 0);
    }
    query += ` ORDER BY code ASC`;

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapItemRow(r));
  }

  public getItem(idOrCode: string): ItemDto | null {
    const row = this.db
      .prepare(
        `SELECT id, code, name_ar, name_en, type, uom_code, cost_minor, selling_price_minor,
                reorder_point_scaled, barcode, shelf_life_days, lot_tracked, expiry_tracked,
                is_active, created_at, updated_at
         FROM items WHERE id = ? OR code = ?`,
      )
      .get(idOrCode, idOrCode) as Record<string, unknown> | undefined;

    return row ? this.mapItemRow(row) : null;
  }

  public createItem(ctx: AuditContext, dto: CreateItemDto): ItemDto {
    const code = dto.code.trim().toUpperCase();
    const existing = this.getItem(code);
    if (existing) {
      throw new RpcError('CONFLICT', 'errors.itemCodeExists', `Item with code ${code} already exists.`);
    }

    const id = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO items (
             id, code, name_ar, name_en, type, uom_code, cost_minor, selling_price_minor,
             reorder_point_scaled, barcode, shelf_life_days, lot_tracked, expiry_tracked,
             is_active, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          code,
          dto.name_ar.trim(),
          dto.name_en.trim(),
          dto.type,
          dto.uom_code,
          dto.cost_minor ?? 0,
          dto.selling_price_minor ?? 0,
          dto.reorder_point_scaled ?? 0,
          dto.barcode || null,
          dto.shelf_life_days ?? null,
          dto.lot_tracked ? 1 : 0,
          dto.expiry_tracked ? 1 : 0,
          dto.is_active === false ? 0 : 1,
          now,
          now,
        );

      this.audit.record({
        actorId: ctx.actorId,
        action: 'catalog.items.created',
        entityType: 'items',
        entityId: id,
        diff: { code, name_ar: dto.name_ar, name_en: dto.name_en, type: dto.type },
      });
    });

    tx();
    return this.getItem(id)!;
  }

  public updateItem(ctx: AuditContext, id: string, dto: UpdateItemDto): ItemDto {
    const current = this.getItem(id);
    if (!current) {
      throw new RpcError('NOT_FOUND', 'errors.itemNotFound', `Item ${id} not found.`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== current.code) {
      const conflict = this.getItem(dto.code.trim().toUpperCase());
      if (conflict && conflict.id !== id) {
        throw new RpcError('CONFLICT', 'errors.itemCodeExists', `Item code ${dto.code} already in use.`);
      }
    }

    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE items SET
             code = COALESCE(?, code),
             name_ar = COALESCE(?, name_ar),
             name_en = COALESCE(?, name_en),
             type = COALESCE(?, type),
             uom_code = COALESCE(?, uom_code),
             cost_minor = COALESCE(?, cost_minor),
             selling_price_minor = COALESCE(?, selling_price_minor),
             reorder_point_scaled = COALESCE(?, reorder_point_scaled),
             barcode = COALESCE(?, barcode),
             shelf_life_days = COALESCE(?, shelf_life_days),
             lot_tracked = COALESCE(?, lot_tracked),
             expiry_tracked = COALESCE(?, expiry_tracked),
             is_active = COALESCE(?, is_active),
             updated_at = ?
           WHERE id = ?`,
        )
        .run(
          dto.code ? dto.code.trim().toUpperCase() : null,
          dto.name_ar ? dto.name_ar.trim() : null,
          dto.name_en ? dto.name_en.trim() : null,
          dto.type ?? null,
          dto.uom_code ?? null,
          dto.cost_minor ?? null,
          dto.selling_price_minor ?? null,
          dto.reorder_point_scaled ?? null,
          dto.barcode ?? null,
          dto.shelf_life_days ?? null,
          dto.lot_tracked !== undefined ? (dto.lot_tracked ? 1 : 0) : null,
          dto.expiry_tracked !== undefined ? (dto.expiry_tracked ? 1 : 0) : null,
          dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : null,
          now,
          id,
        );

      this.audit.record({
        actorId: ctx.actorId,
        action: 'catalog.items.updated',
        entityType: 'items',
        entityId: id,
        diff: dto,
      });
    });

    tx();
    return this.getItem(id)!;
  }

  public deleteItem(ctx: AuditContext, id: string): { deleted: boolean } {
    const current = this.getItem(id);
    if (!current) {
      throw new RpcError('NOT_FOUND', 'errors.itemNotFound', `Item ${id} not found.`);
    }

    // Check usage in movements, work orders, or recipes
    const movCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM inventory_movements WHERE item_id = ?').get(id) as { cnt: number }
    ).cnt;
    const woCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM work_orders WHERE item_id = ?').get(id) as { cnt: number }
    ).cnt;
    const rcpCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM recipe_items WHERE item_id = ?').get(id) as { cnt: number }
    ).cnt;

    if (movCount > 0 || woCount > 0 || rcpCount > 0) {
      throw new RpcError(
        'CONFLICT',
        'errors.itemInUse',
        'Cannot delete item with existing inventory movements, work orders, or recipe dependencies.',
      );
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM items WHERE id = ?').run(id);
      this.audit.record({
        actorId: ctx.actorId,
        action: 'catalog.items.deleted',
        entityType: 'items',
        entityId: id,
        diff: { code: current.code },
      });
    });

    tx();
    return { deleted: true };
  }

  // --- WORK CENTERS ---
  public listWorkCenters(industry?: IndustryVertical): WorkCenterDto[] {
    let query = `
      SELECT id, code, name_ar, name_en, industry_vertical, labor_rate_minor, overhead_rate_minor,
             capacity_per_hour_scaled, is_active, created_at
      FROM work_centers
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (industry) {
      query += ` AND industry_vertical = ?`;
      params.push(industry);
    }
    query += ` ORDER BY code ASC`;

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      industry_vertical: r.industry_vertical as IndustryVertical,
      labor_rate_minor: Number(r.labor_rate_minor),
      overhead_rate_minor: Number(r.overhead_rate_minor),
      capacity_per_hour_scaled: Number(r.capacity_per_hour_scaled),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    }));
  }

  public getWorkCenter(idOrCode: string): WorkCenterDto | null {
    const r = this.db
      .prepare(
        `SELECT id, code, name_ar, name_en, industry_vertical, labor_rate_minor, overhead_rate_minor,
                capacity_per_hour_scaled, is_active, created_at
         FROM work_centers WHERE id = ? OR code = ?`,
      )
      .get(idOrCode, idOrCode) as Record<string, unknown> | undefined;

    if (!r) return null;
    return {
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      industry_vertical: r.industry_vertical as IndustryVertical,
      labor_rate_minor: Number(r.labor_rate_minor),
      overhead_rate_minor: Number(r.overhead_rate_minor),
      capacity_per_hour_scaled: Number(r.capacity_per_hour_scaled),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    };
  }

  public createWorkCenter(ctx: AuditContext, dto: CreateWorkCenterDto): WorkCenterDto {
    const code = dto.code.trim().toUpperCase();
    const existing = this.getWorkCenter(code);
    if (existing) {
      throw new RpcError('CONFLICT', 'errors.workCenterExists', `Work center with code ${code} already exists.`);
    }

    const id = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO work_centers (
             id, code, name_ar, name_en, industry_vertical, labor_rate_minor, overhead_rate_minor,
             capacity_per_hour_scaled, is_active, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          code,
          dto.name_ar.trim(),
          dto.name_en.trim(),
          dto.industry_vertical,
          dto.labor_rate_minor,
          dto.overhead_rate_minor,
          dto.capacity_per_hour_scaled ?? 10000,
          dto.is_active === false ? 0 : 1,
          now,
        );

      this.audit.record({
        actorId: ctx.actorId,
        action: 'catalog.workCenters.created',
        entityType: 'work_centers',
        entityId: id,
        diff: { code },
      });
    });

    tx();
    return this.getWorkCenter(id)!;
  }

  public updateWorkCenter(ctx: AuditContext, id: string, dto: UpdateWorkCenterDto): WorkCenterDto {
    const current = this.getWorkCenter(id);
    if (!current) {
      throw new RpcError('NOT_FOUND', 'errors.workCenterNotFound', `Work center ${id} not found.`);
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE work_centers SET
             code = COALESCE(?, code),
             name_ar = COALESCE(?, name_ar),
             name_en = COALESCE(?, name_en),
             industry_vertical = COALESCE(?, industry_vertical),
             labor_rate_minor = COALESCE(?, labor_rate_minor),
             overhead_rate_minor = COALESCE(?, overhead_rate_minor),
             capacity_per_hour_scaled = COALESCE(?, capacity_per_hour_scaled),
             is_active = COALESCE(?, is_active)
           WHERE id = ?`,
        )
        .run(
          dto.code ? dto.code.trim().toUpperCase() : null,
          dto.name_ar ? dto.name_ar.trim() : null,
          dto.name_en ? dto.name_en.trim() : null,
          dto.industry_vertical ?? null,
          dto.labor_rate_minor ?? null,
          dto.overhead_rate_minor ?? null,
          dto.capacity_per_hour_scaled ?? null,
          dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : null,
          id,
        );

      this.audit.record({
        actorId: ctx.actorId,
        action: 'catalog.workCenters.updated',
        entityType: 'work_centers',
        entityId: id,
        diff: dto,
      });
    });

    tx();
    return this.getWorkCenter(id)!;
  }

  public deleteWorkCenter(ctx: AuditContext, id: string): { deleted: boolean } {
    const current = this.getWorkCenter(id);
    if (!current) {
      throw new RpcError('NOT_FOUND', 'errors.workCenterNotFound', `Work center ${id} not found.`);
    }

    const routingCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM recipe_routings WHERE work_center_id = ?').get(id) as { cnt: number }
    ).cnt;

    if (routingCount > 0) {
      throw new RpcError(
        'CONFLICT',
        'errors.workCenterInUse',
        'Cannot delete work center assigned to active recipes or routing steps.',
      );
    }

    this.db.prepare('DELETE FROM work_centers WHERE id = ?').run(id);
    return { deleted: true };
  }

  // --- SUPPLIERS & LOCATIONS ---
  public listSuppliers(): SupplierDto[] {
    const rows = this.db
      .prepare('SELECT id, code, name_ar, name_en, tax_number, contact_phone, contact_email, is_active, created_at FROM suppliers ORDER BY code ASC')
      .all() as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      tax_number: r.tax_number ? String(r.tax_number) : null,
      contact_phone: r.contact_phone ? String(r.contact_phone) : null,
      contact_email: r.contact_email ? String(r.contact_email) : null,
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
    }));
  }

  public listLocations(): LocationDto[] {
    const rows = this.db
      .prepare('SELECT id, code, name_ar, name_en, type, created_at FROM locations ORDER BY code ASC')
      .all() as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      type: r.type as LocationDto['type'],
      is_active: true,
      created_at: String(r.created_at || '2026-10-14T00:00:00.000Z'),
    }));
  }

  private mapItemRow(r: Record<string, unknown>): ItemDto {
    return {
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      type: r.type as ItemType,
      uom_code: String(r.uom_code),
      cost_minor: Number(r.cost_minor),
      selling_price_minor: Number(r.selling_price_minor ?? 0),
      reorder_point_scaled: Number(r.reorder_point_scaled),
      barcode: r.barcode ? String(r.barcode) : null,
      shelf_life_days: r.shelf_life_days !== null && r.shelf_life_days !== undefined ? Number(r.shelf_life_days) : null,
      lot_tracked: Boolean(r.lot_tracked ?? 1),
      expiry_tracked: Boolean(r.expiry_tracked ?? 1),
      is_active: Boolean(r.is_active),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
