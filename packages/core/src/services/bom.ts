import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';

export type IndustryVertical = 'FOOD_BEV' | 'TEXTILE' | 'GENERAL';

export interface WorkCenter {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  labor_rate_minor: number;
  overhead_rate_minor: number;
  capacity_per_hour_scaled: number;
  is_active: number;
  created_at: string;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  item_id: string;
  item_code?: string;
  item_name_ar?: string;
  item_name_en?: string;
  uom_code?: string;
  unit_cost_minor?: number;
  quantity_scaled: number;
  scrap_tolerance_pct_scaled: number;
  notes?: string | null;
}

export interface RecipeByProduct {
  id: string;
  recipe_id: string;
  item_id: string;
  item_code?: string;
  item_name_ar?: string;
  item_name_en?: string;
  uom_code?: string;
  yield_quantity_scaled: number;
  salvage_value_minor: number;
  notes?: string | null;
}

export interface RecipeRouting {
  id: string;
  recipe_id: string;
  work_center_id: string;
  work_center_code?: string;
  work_center_name_ar?: string;
  work_center_name_en?: string;
  step_order: number;
  name_ar: string;
  name_en: string;
  setup_time_mins: number;
  run_time_mins_scaled: number;
  labor_headcount: number;
  labor_rate_minor?: number;
  overhead_rate_minor?: number;
}

export interface Recipe {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  output_item_id: string;
  output_item_code?: string;
  output_item_name_ar?: string;
  output_item_name_en?: string;
  output_uom?: string;
  base_quantity_scaled: number;
  expected_yield_pct_scaled: number;
  overhead_flat_minor: number;
  version: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  items?: RecipeItem[];
  byproducts?: RecipeByProduct[];
  routings?: RecipeRouting[];
}

export interface CostBreakdown {
  recipeId: string;
  baseQuantityScaled: number;
  totalDirectMaterialMinor: number;
  totalDirectLaborMinor: number;
  totalMachineOverheadMinor: number;
  byproductCreditMinor: number;
  totalBatchCostMinor: number;
  unitCostMinor: number;
  expectedYieldQtyScaled: number;
  itemsCost: Array<{
    itemId: string;
    itemCode: string;
    nameAr: string;
    nameEn: string;
    quantityScaled: number;
    unitCostMinor: number;
    lineCostMinor: number;
    scrapPct: number;
  }>;
  routingsCost: Array<{
    stepOrder: number;
    stepNameEn: string;
    workCenterCode: string;
    laborCostMinor: number;
    machineCostMinor: number;
    totalStepCostMinor: number;
  }>;
}

export class BomService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  listRecipes(industry?: IndustryVertical): Recipe[] {
    let sql = `
      SELECT r.*, i.code AS output_item_code, i.name_ar AS output_item_name_ar,
             i.name_en AS output_item_name_en, i.uom_code AS output_uom
      FROM recipes r
      JOIN items i ON r.output_item_id = i.id
    `;
    const params: unknown[] = [];
    if (industry) {
      sql += ' WHERE r.industry_vertical = ?';
      params.push(industry);
    }
    sql += ' ORDER BY r.code ASC';

    return this.db.prepare(sql).all(...params) as Recipe[];
  }

  getRecipe(id: string): Recipe | null {
    const header = this.db
      .prepare(
        `SELECT r.*, i.code AS output_item_code, i.name_ar AS output_item_name_ar,
                i.name_en AS output_item_name_en, i.uom_code AS output_uom
         FROM recipes r
         JOIN items i ON r.output_item_id = i.id
         WHERE r.id = ?`,
      )
      .get(id) as Recipe | undefined;

    if (!header) return null;

    const items = this.db
      .prepare(
        `SELECT ri.*, i.code AS item_code, i.name_ar AS item_name_ar, i.name_en AS item_name_en,
                i.uom_code, i.cost_minor AS unit_cost_minor
         FROM recipe_items ri
         JOIN items i ON ri.item_id = i.id
         WHERE ri.recipe_id = ?
         ORDER BY ri.rowid ASC`,
      )
      .all(id) as RecipeItem[];

    const byproducts = this.db
      .prepare(
        `SELECT rb.*, i.code AS item_code, i.name_ar AS item_name_ar, i.name_en AS item_name_en,
                i.uom_code
         FROM recipe_byproducts rb
         JOIN items i ON rb.item_id = i.id
         WHERE rb.recipe_id = ?`,
      )
      .all(id) as RecipeByProduct[];

    const routings = this.db
      .prepare(
        `SELECT rr.*, wc.code AS work_center_code, wc.name_ar AS work_center_name_ar,
                wc.name_en AS work_center_name_en, wc.labor_rate_minor, wc.overhead_rate_minor
         FROM recipe_routings rr
         JOIN work_centers wc ON rr.work_center_id = wc.id
         WHERE rr.recipe_id = ?
         ORDER BY rr.step_order ASC`,
      )
      .all(id) as RecipeRouting[];

    return {
      ...header,
      items,
      byproducts,
      routings,
    };
  }

  /**
   * Calculate precise standard cost breakdown for a given batch size or standard base size
   */
  calculateCost(recipeId: string, overrideBatchQuantityScaled?: number): CostBreakdown {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) throw new Error(`Recipe not found: ${recipeId}`);

    const baseQty = recipe.base_quantity_scaled;
    const batchQty = overrideBatchQuantityScaled ?? baseQty;
    // Scale factor = batchQty / baseQty
    const scale = batchQty / (baseQty || 10000);

    let totalDirectMaterialMinor = 0;
    const itemsCost: CostBreakdown['itemsCost'] = [];

    for (const item of recipe.items ?? []) {
      const scaledItemQty = Math.round(item.quantity_scaled * scale);
      // add scrap allowance: qty * (1 + scrap / 1000000)
      const scrapFactor = 1 + (item.scrap_tolerance_pct_scaled || 0) / 1000000;
      const totalRequiredQty = Math.round(scaledItemQty * scrapFactor);
      
      // Cost in halalas = (totalRequiredQty / 10,000) * unit_cost_minor
      const lineCost = Math.round((totalRequiredQty * (item.unit_cost_minor || 0)) / 10000);
      totalDirectMaterialMinor += lineCost;

      itemsCost.push({
        itemId: item.item_id,
        itemCode: item.item_code ?? '',
        nameAr: item.item_name_ar ?? '',
        nameEn: item.item_name_en ?? '',
        quantityScaled: totalRequiredQty,
        unitCostMinor: item.unit_cost_minor || 0,
        lineCostMinor: lineCost,
        scrapPct: (item.scrap_tolerance_pct_scaled || 0) / 10000,
      });
    }

    // By-product salvage credit
    let byproductCreditMinor = 0;
    for (const bp of recipe.byproducts ?? []) {
      const bpQty = Math.round(bp.yield_quantity_scaled * scale);
      const credit = Math.round((bpQty * (bp.salvage_value_minor || 0)) / 10000);
      byproductCreditMinor += credit;
    }

    // Direct Labor & Station Overheads
    let totalDirectLaborMinor = 0;
    let totalMachineOverheadMinor = Math.round((recipe.overhead_flat_minor || 0) * scale);
    const routingsCost: CostBreakdown['routingsCost'] = [];

    for (const r of recipe.routings ?? []) {
      // run_time_mins = setup_time + (run_time_mins_scaled / 10,000) * (batchQty / 10,000)
      const batchUnits = batchQty / 10000;
      const totalMinutes = r.setup_time_mins + (r.run_time_mins_scaled / 10000) * batchUnits;
      const hours = totalMinutes / 60;

      // Labor = hours * headcount * labor_rate
      const stepLabor = Math.round(hours * r.labor_headcount * (r.labor_rate_minor || 0));
      // Machine = hours * overhead_rate
      const stepMachine = Math.round(hours * (r.overhead_rate_minor || 0));

      totalDirectLaborMinor += stepLabor;
      totalMachineOverheadMinor += stepMachine;

      routingsCost.push({
        stepOrder: r.step_order,
        stepNameEn: r.name_en,
        workCenterCode: r.work_center_code ?? '',
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
      recipeId,
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
}
