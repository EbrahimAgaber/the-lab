import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { AuditService, type AuditContext } from './audit';
import type {
  CostBreakdownDto,
  CreateRecipeDto,
  IndustryVertical,
  RecipeDto,
  UpdateRecipeDto,
} from '@the-lab/contract';
import { RpcError } from '@the-lab/contract';

export class BomService {
  private audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.audit = new AuditService(db, clock, ids);
  }

  public listRecipes(industry?: IndustryVertical): RecipeDto[] {
    let sql = `
      SELECT r.id, r.code, r.name_ar, r.name_en, r.industry_vertical, r.output_item_id,
             r.base_quantity_scaled, r.expected_yield_pct_scaled, r.overhead_flat_minor,
             r.version, r.is_active, r.created_at, r.updated_at,
             i.code AS output_item_code, i.name_ar AS output_item_name_ar,
             i.name_en AS output_item_name_en, i.uom_code AS output_uom
      FROM recipes r
      JOIN items i ON r.output_item_id = i.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (industry) {
      sql += ' AND r.industry_vertical = ?';
      params.push(industry);
    }
    sql += ' ORDER BY r.code ASC';

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapRecipeSummary(r));
  }

  public getRecipe(id: string): RecipeDto | null {
    const header = this.db
      .prepare(
        `SELECT r.id, r.code, r.name_ar, r.name_en, r.industry_vertical, r.output_item_id,
                r.base_quantity_scaled, r.expected_yield_pct_scaled, r.overhead_flat_minor,
                r.version, r.is_active, r.created_at, r.updated_at,
                i.code AS output_item_code, i.name_ar AS output_item_name_ar,
                i.name_en AS output_item_name_en, i.uom_code AS output_uom
         FROM recipes r
         JOIN items i ON r.output_item_id = i.id
         WHERE r.id = ? OR r.code = ?`,
      )
      .get(id, id) as Record<string, unknown> | undefined;

    if (!header) return null;
    const recipeId = String(header.id);

    const items = this.db
      .prepare(
        `SELECT ri.id, ri.item_id, ri.quantity_scaled, ri.scrap_tolerance_pct_scaled, ri.notes,
                i.code AS item_code, i.name_ar AS item_name_ar, i.name_en AS item_name_en,
                i.uom_code, i.cost_minor AS unit_cost_minor
         FROM recipe_items ri
         JOIN items i ON ri.item_id = i.id
         WHERE ri.recipe_id = ?
         ORDER BY ri.rowid ASC`,
      )
      .all(recipeId) as Record<string, unknown>[];

    const byproducts = this.db
      .prepare(
        `SELECT rb.id, rb.item_id, rb.yield_quantity_scaled, rb.salvage_value_minor, rb.notes,
                i.code AS item_code, i.name_ar AS item_name_ar, i.name_en AS item_name_en,
                i.uom_code
         FROM recipe_byproducts rb
         JOIN items i ON rb.item_id = i.id
         WHERE rb.recipe_id = ?`,
      )
      .all(recipeId) as Record<string, unknown>[];

    const routings = this.db
      .prepare(
        `SELECT rr.id, rr.work_center_id, rr.step_order, rr.name_ar, rr.name_en,
                rr.setup_time_mins, rr.run_time_mins_scaled, rr.labor_headcount,
                wc.code AS work_center_code, wc.name_ar AS work_center_name_ar,
                wc.name_en AS work_center_name_en, wc.labor_rate_minor, wc.overhead_rate_minor
         FROM recipe_routings rr
         JOIN work_centers wc ON rr.work_center_id = wc.id
         WHERE rr.recipe_id = ?
         ORDER BY rr.step_order ASC`,
      )
      .all(recipeId) as Record<string, unknown>[];

    return {
      id: String(header.id),
      code: String(header.code),
      name_ar: String(header.name_ar),
      name_en: String(header.name_en),
      industry_vertical: header.industry_vertical as IndustryVertical,
      output_item_id: String(header.output_item_id),
      output_item_code: String(header.output_item_code),
      output_item_name_ar: String(header.output_item_name_ar),
      output_item_name_en: String(header.output_item_name_en),
      output_uom: String(header.output_uom),
      base_quantity_scaled: Number(header.base_quantity_scaled),
      expected_yield_pct_scaled: Number(header.expected_yield_pct_scaled),
      overhead_flat_minor: Number(header.overhead_flat_minor),
      version: Number(header.version),
      is_active: Boolean(header.is_active),
      items: items.map((it) => ({
        id: String(it.id),
        item_id: String(it.item_id),
        item_code: String(it.item_code),
        item_name_ar: String(it.item_name_ar),
        item_name_en: String(it.item_name_en),
        uom_code: String(it.uom_code),
        unit_cost_minor: Number(it.unit_cost_minor || 0),
        quantity_scaled: Number(it.quantity_scaled),
        scrap_tolerance_pct_scaled: Number(it.scrap_tolerance_pct_scaled || 0),
        notes: it.notes ? String(it.notes) : undefined,
      })),
      byproducts: byproducts.map((bp) => ({
        id: String(bp.id),
        item_id: String(bp.item_id),
        item_code: String(bp.item_code),
        item_name_ar: String(bp.item_name_ar),
        item_name_en: String(bp.item_name_en),
        uom_code: String(bp.uom_code),
        yield_quantity_scaled: Number(bp.yield_quantity_scaled),
        salvage_value_minor: Number(bp.salvage_value_minor || 0),
        notes: bp.notes ? String(bp.notes) : undefined,
      })),
      routings: routings.map((rt) => ({
        id: String(rt.id),
        work_center_code: String(rt.work_center_code),
        work_center_name_ar: String(rt.work_center_name_ar),
        work_center_name_en: String(rt.work_center_name_en),
        step_order: Number(rt.step_order),
        name_ar: String(rt.name_ar),
        name_en: String(rt.name_en),
        setup_time_mins: Number(rt.setup_time_mins || 0),
        run_time_mins_scaled: Number(rt.run_time_mins_scaled || 0),
        labor_headcount: Number(rt.labor_headcount || 1),
        labor_rate_minor: Number(rt.labor_rate_minor || 0),
        overhead_rate_minor: Number(rt.overhead_rate_minor || 0),
      })),
      created_at: String(header.created_at),
      updated_at: String(header.updated_at),
    };
  }

  public createRecipe(ctx: AuditContext, dto: CreateRecipeDto): RecipeDto {
    const code = dto.code.trim().toUpperCase();
    const existing = this.getRecipe(code);
    if (existing) {
      throw new RpcError('CONFLICT', 'errors.recipeCodeExists', `Recipe with code ${code} already exists.`);
    }

    const id = this.ids.next();
    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO recipes (
             id, code, name_ar, name_en, industry_vertical, output_item_id,
             base_quantity_scaled, expected_yield_pct_scaled, overhead_flat_minor,
             version, is_active, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
        )
        .run(
          id,
          code,
          dto.name_ar.trim(),
          dto.name_en.trim(),
          dto.industry_vertical,
          dto.output_item_id,
          dto.base_quantity_scaled,
          dto.expected_yield_pct_scaled ?? 1000000,
          dto.overhead_flat_minor ?? 0,
          now,
          now,
        );

      // Recipe BOM Items
      if (dto.items) {
        for (const it of dto.items) {
          const riId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(riId, id, it.item_id, it.quantity_scaled, it.scrap_tolerance_pct_scaled ?? 0, it.notes || null);
        }
      }

      // Byproducts
      if (dto.byproducts) {
        for (const bp of dto.byproducts) {
          const bpId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_byproducts (id, recipe_id, item_id, yield_quantity_scaled, salvage_value_minor, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(bpId, id, bp.item_id, bp.yield_quantity_scaled, bp.salvage_value_minor ?? 0, bp.notes || null);
        }
      }

      // Routings
      if (dto.routings) {
        for (const rt of dto.routings) {
          const wcRow = this.db
            .prepare('SELECT id FROM work_centers WHERE code = ? OR id = ?')
            .get(rt.work_center_code, rt.work_center_code) as { id: string } | undefined;

          if (!wcRow) {
            throw new RpcError('NOT_FOUND', 'errors.workCenterNotFound', `Work center ${rt.work_center_code} not found.`);
          }

          const rrId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_routings (
                 id, recipe_id, work_center_id, step_order, name_ar, name_en,
                 setup_time_mins, run_time_mins_scaled, labor_headcount
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              rrId,
              id,
              wcRow.id,
              rt.step_order,
              rt.name_ar,
              rt.name_en,
              rt.setup_time_mins,
              rt.run_time_mins_scaled,
              rt.labor_headcount,
            );
        }
      }

      this.audit.record({
        actorId: ctx.actorId,
        action: 'manufacturing.recipes.created',
        entityType: 'recipes',
        entityId: id,
        diff: { code, outputItemId: dto.output_item_id },
      });
    });

    tx();
    return this.getRecipe(id)!;
  }

  public updateRecipe(ctx: AuditContext, id: string, dto: UpdateRecipeDto): RecipeDto {
    const current = this.getRecipe(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.recipeNotFound', `Recipe ${id} not found.`);

    const now = this.clock.now().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE recipes SET
             code = COALESCE(?, code),
             name_ar = COALESCE(?, name_ar),
             name_en = COALESCE(?, name_en),
             industry_vertical = COALESCE(?, industry_vertical),
             output_item_id = COALESCE(?, output_item_id),
             base_quantity_scaled = COALESCE(?, base_quantity_scaled),
             expected_yield_pct_scaled = COALESCE(?, expected_yield_pct_scaled),
             overhead_flat_minor = COALESCE(?, overhead_flat_minor),
             is_active = COALESCE(?, is_active),
             version = version + 1,
             updated_at = ?
           WHERE id = ?`,
        )
        .run(
          dto.code ? dto.code.trim().toUpperCase() : null,
          dto.name_ar ? dto.name_ar.trim() : null,
          dto.name_en ? dto.name_en.trim() : null,
          dto.industry_vertical ?? null,
          dto.output_item_id ?? null,
          dto.base_quantity_scaled ?? null,
          dto.expected_yield_pct_scaled ?? null,
          dto.overhead_flat_minor ?? null,
          dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : null,
          now,
          id,
        );

      if (dto.items) {
        this.db.prepare('DELETE FROM recipe_items WHERE recipe_id = ?').run(id);
        for (const it of dto.items) {
          const riId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(riId, id, it.item_id, it.quantity_scaled, it.scrap_tolerance_pct_scaled ?? 0, it.notes || null);
        }
      }

      if (dto.byproducts) {
        this.db.prepare('DELETE FROM recipe_byproducts WHERE recipe_id = ?').run(id);
        for (const bp of dto.byproducts) {
          const bpId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_byproducts (id, recipe_id, item_id, yield_quantity_scaled, salvage_value_minor, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(bpId, id, bp.item_id, bp.yield_quantity_scaled, bp.salvage_value_minor ?? 0, bp.notes || null);
        }
      }

      if (dto.routings) {
        this.db.prepare('DELETE FROM recipe_routings WHERE recipe_id = ?').run(id);
        for (const rt of dto.routings) {
          const wcRow = this.db
            .prepare('SELECT id FROM work_centers WHERE code = ? OR id = ?')
            .get(rt.work_center_code, rt.work_center_code) as { id: string } | undefined;

          if (!wcRow) {
            throw new RpcError('NOT_FOUND', 'errors.workCenterNotFound', `Work center ${rt.work_center_code} not found.`);
          }

          const rrId = this.ids.next();
          this.db
            .prepare(
              `INSERT INTO recipe_routings (
                 id, recipe_id, work_center_id, step_order, name_ar, name_en,
                 setup_time_mins, run_time_mins_scaled, labor_headcount
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              rrId,
              id,
              wcRow.id,
              rt.step_order,
              rt.name_ar,
              rt.name_en,
              rt.setup_time_mins,
              rt.run_time_mins_scaled,
              rt.labor_headcount,
            );
        }
      }

      this.audit.record({
        actorId: ctx.actorId,
        action: 'manufacturing.recipes.updated',
        entityType: 'recipes',
        entityId: id,
        diff: dto,
      });
    });

    tx();
    return this.getRecipe(id)!;
  }

  public deleteRecipe(ctx: AuditContext, id: string): { deleted: boolean } {
    const current = this.getRecipe(id);
    if (!current) throw new RpcError('NOT_FOUND', 'errors.recipeNotFound', `Recipe ${id} not found.`);

    // Safeguard: recipes used by work orders cannot be cascade deleted!
    const woCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM work_orders WHERE recipe_id = ?').get(id) as { cnt: number }
    ).cnt;

    if (woCount > 0) {
      throw new RpcError('CONFLICT', 'errors.recipeInUse', 'Cannot delete recipe that has associated work orders.');
    }

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM recipe_items WHERE recipe_id = ?').run(id);
      this.db.prepare('DELETE FROM recipe_byproducts WHERE recipe_id = ?').run(id);
      this.db.prepare('DELETE FROM recipe_routings WHERE recipe_id = ?').run(id);
      this.db.prepare('DELETE FROM recipes WHERE id = ?').run(id);

      this.audit.record({
        actorId: ctx.actorId,
        action: 'manufacturing.recipes.deleted',
        entityType: 'recipes',
        entityId: id,
        diff: { code: current.code },
      });
    });

    tx();
    return { deleted: true };
  }

  public calculateCost(recipeId: string, batchQtyScaled?: number): CostBreakdownDto {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) throw new RpcError('NOT_FOUND', 'errors.recipeNotFound', `Recipe ${recipeId} not found.`);

    const baseQty = recipe.base_quantity_scaled;
    const batchQty = batchQtyScaled ?? baseQty;
    const scale = batchQty / (baseQty || 10000);

    let totalDirectMaterialMinor = 0;
    const itemsCost: CostBreakdownDto['itemsCost'] = [];

    for (const it of recipe.items) {
      const scaledQty = Math.round(it.quantity_scaled * scale);
      const scrapFactor = 1 + (it.scrap_tolerance_pct_scaled || 0) / 1000000;
      const requiredQty = Math.round(scaledQty * scrapFactor);
      const lineCost = Math.round((requiredQty * it.unit_cost_minor) / 10000);
      totalDirectMaterialMinor += lineCost;

      itemsCost.push({
        itemId: it.item_id,
        itemCode: it.item_code,
        nameAr: it.item_name_ar,
        nameEn: it.item_name_en,
        quantityScaled: requiredQty,
        unitCostMinor: it.unit_cost_minor,
        lineCostMinor: lineCost,
        scrapPct: (it.scrap_tolerance_pct_scaled || 0) / 10000,
      });
    }

    let byproductCreditMinor = 0;
    for (const bp of recipe.byproducts) {
      const bpQty = Math.round(bp.yield_quantity_scaled * scale);
      const credit = Math.round((bpQty * bp.salvage_value_minor) / 10000);
      byproductCreditMinor += credit;
    }

    let totalDirectLaborMinor = 0;
    let totalMachineOverheadMinor = Math.round(recipe.overhead_flat_minor * scale);
    const routingsCost: CostBreakdownDto['routingsCost'] = [];

    for (const r of recipe.routings) {
      const batchUnits = batchQty / 10000;
      const totalMinutes = r.setup_time_mins + (r.run_time_mins_scaled / 10000) * batchUnits;
      const hours = totalMinutes / 60;
      const stepLabor = Math.round(hours * r.labor_headcount * r.labor_rate_minor);
      const stepMachine = Math.round(hours * r.overhead_rate_minor);

      totalDirectLaborMinor += stepLabor;
      totalMachineOverheadMinor += stepMachine;

      routingsCost.push({
        stepOrder: r.step_order,
        stepNameEn: r.name_en,
        workCenterCode: r.work_center_code,
        laborCostMinor: stepLabor,
        machineCostMinor: stepMachine,
        totalStepCostMinor: stepLabor + stepMachine,
      });
    }

    const totalBatchCostMinor =
      totalDirectMaterialMinor +
      totalDirectLaborMinor +
      totalMachineOverheadMinor -
      byproductCreditMinor;

    const yieldPct = (recipe.expected_yield_pct_scaled || 1000000) / 1000000;
    const expectedYieldQtyScaled = Math.round(batchQty * yieldPct);
    const expectedYieldUnits = expectedYieldQtyScaled / 10000;
    const unitCostMinor =
      expectedYieldUnits > 0 ? Math.round(totalBatchCostMinor / expectedYieldUnits) : 0;

    return {
      recipeId: recipe.id,
      baseQuantityScaled: batchQty,
      totalDirectMaterialMinor,
      totalDirectLaborMinor,
      totalMachineOverheadMinor,
      byproductCreditMinor,
      totalBatchCostMinor,
      unitCostMinor,
      expectedYieldQtyScaled,
      itemsCost,
      routingsCost,
    };
  }

  private mapRecipeSummary(r: Record<string, unknown>): RecipeDto {
    return {
      id: String(r.id),
      code: String(r.code),
      name_ar: String(r.name_ar),
      name_en: String(r.name_en),
      industry_vertical: r.industry_vertical as IndustryVertical,
      output_item_id: String(r.output_item_id),
      output_item_code: String(r.output_item_code),
      output_item_name_ar: String(r.output_item_name_ar),
      output_item_name_en: String(r.output_item_name_en),
      output_uom: String(r.output_uom),
      base_quantity_scaled: Number(r.base_quantity_scaled),
      expected_yield_pct_scaled: Number(r.expected_yield_pct_scaled),
      overhead_flat_minor: Number(r.overhead_flat_minor),
      version: Number(r.version),
      is_active: Boolean(r.is_active),
      items: [],
      byproducts: [],
      routings: [],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
