import { describe, expect, it } from 'vitest';
import { BomService } from '../src';
import { createTestDb, seedBenchmarkTestData } from './helpers/test-db';

describe('BomService & Cost Configuration Engine', () => {
  it('calculates recipe unit costs accurately according to business formulas', () => {
    const { db, clock, ids } = createTestDb();
    seedBenchmarkTestData(db);

    const bomService = new BomService(db, clock, ids);

    // 1. List recipes
    const allRecipes = bomService.listRecipes();
    expect(allRecipes.length).toBeGreaterThanOrEqual(1);

    // 2. F&B Recipe Cost Calculation
    const foodRecipe = allRecipes.find((r) => r.industry_vertical === 'FOOD_BEV')!;
    expect(foodRecipe).toBeDefined();
    expect(foodRecipe.code).toBe('RCP-FB-TOM-01');

    const foodCost = bomService.calculateCost(foodRecipe.id);
    expect(foodCost.totalDirectMaterialMinor).toBeGreaterThan(0);
    expect(foodCost.totalDirectLaborMinor).toBeGreaterThan(0);
    expect(foodCost.totalMachineOverheadMinor).toBeGreaterThan(0);
    expect(foodCost.byproductCreditMinor).toBeGreaterThan(0);
    expect(foodCost.unitCostMinor).toBeGreaterThan(0);
    expect(foodCost.itemsCost.length).toBe(4);
    expect(foodCost.routingsCost.length).toBe(3);

    // Verify Business Analyst formulas:
    // Total batch cost = materials + labor + machine - byproduct credit
    expect(foodCost.totalBatchCostMinor).toBe(
      foodCost.totalDirectMaterialMinor +
        foodCost.totalDirectLaborMinor +
        foodCost.totalMachineOverheadMinor -
        foodCost.byproductCreditMinor,
    );

    db.close();
  });
});
