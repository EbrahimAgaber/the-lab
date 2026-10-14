import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  openDatabase,
  runMigrations,
  seedInitialData,
  BomService,
  systemClock,
  sequentialIds,
  type SqlDatabase,
} from '../src';

const factory = (f: string) => new Database(f) as unknown as SqlDatabase;

describe('BomService & Cost Configuration Engine', () => {
  it('seeds F&B and Textile recipes and calculates unit costs accurately', () => {
    const db = openDatabase({ filename: ':memory:', factory });
    runMigrations(db);

    const clock = systemClock;
    const ids = sequentialIds('seed');

    const seedRes = seedInitialData(db, clock, ids);
    expect(seedRes.seeded).toBe(true);

    const bomService = new BomService(db, clock, ids);

    // 1. List recipes
    const allRecipes = bomService.listRecipes();
    expect(allRecipes.length).toBeGreaterThanOrEqual(2);

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

    // 3. Textile Recipe Cost Calculation
    const texRecipe = allRecipes.find((r) => r.industry_vertical === 'TEXTILE')!;
    expect(texRecipe).toBeDefined();
    expect(texRecipe.code).toBe('BOM-TEX-SHRT-L');

    const texCost = bomService.calculateCost(texRecipe.id);
    expect(texCost.totalDirectMaterialMinor).toBeGreaterThan(0);
    expect(texCost.totalDirectLaborMinor).toBeGreaterThan(0);
    expect(texCost.unitCostMinor).toBeGreaterThan(0);
    expect(texCost.itemsCost.length).toBe(4);
    expect(texCost.routingsCost.length).toBe(3);

    db.close();
  });
});
