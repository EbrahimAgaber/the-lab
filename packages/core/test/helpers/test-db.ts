import Database from 'better-sqlite3';
import { openDatabase, type SqlDatabase } from '../../src/db';
import { runMigrations } from '../../src/migrations/runner';
import { systemClock, sequentialIds, type Clock, type IdGenerator } from '../../src/runtime';

export function createTestDb(): {
  db: SqlDatabase;
  clock: Clock;
  ids: IdGenerator;
} {
  const factory = () => new Database(':memory:') as unknown as SqlDatabase;
  const db = openDatabase({ filename: ':memory:', factory });
  runMigrations(db);
  const clock = systemClock;
  const ids = sequentialIds('test');
  return { db, clock, ids };
}

/**
 * Test-only helper to seed benchmark data for test assertions.
 * This is NEVER exported from the core package or accessible in production.
 */
export function seedBenchmarkTestData(db: SqlDatabase): void {
  const now = new Date().toISOString();

  // Test Locations
  const locations = [
    ['loc-raw-main', 'LOC-RAW', 'مستودع المواد الخام', 'Raw Warehouse', 'WAREHOUSE'],
    ['loc-cold-room', 'LOC-COLD', 'غرفة التبريد المركزية', 'Central Cold Room', 'COLD_ROOM'],
    ['loc-prod-line-1', 'LOC-PRD-1', 'خط الإنتاج 1', 'Production Line 1', 'PRODUCTION'],
    ['loc-scrap-bay', 'LOC-SCRAP', 'منطقة الهدر', 'Scrap Bay', 'SCRAP'],
  ];
  for (const [id, code, ar, en, type] of locations) {
    db.prepare('INSERT OR IGNORE INTO locations (id, code, name_ar, name_en, type) VALUES (?, ?, ?, ?, ?)').run(
      id,
      code,
      ar,
      en,
      type,
    );
  }

  // Test Items
  const items = [
    ['itm-fresh-tomato', 'RAW-TOM-01', 'طماطم طازجة', 'Fresh Tomatoes', 'RAW', 'KG', 250, 5000000],
    ['itm-salt-foodgrade', 'RAW-SLT-01', 'ملح طعام', 'Food Grade Salt', 'RAW', 'KG', 80, 1000000],
    ['itm-citric-acid', 'RAW-CIT-01', 'حمض الستريك', 'Citric Acid', 'RAW', 'KG', 600, 500000],
    ['itm-glass-jar-800g', 'PKG-JAR-800', 'مرطبان زجاجي 800 جم', 'Glass Jar 800g', 'PACKAGING', 'PCS', 120, 20000000],
    ['itm-tomato-skin-scrap', 'BYP-TOM-SKIN', 'قشور الطماطم', 'Tomato Pomace', 'INTERMEDIATE', 'KG', 20, 0],
    ['itm-tomato-paste-800g', 'FG-TOM-800', 'معجون طماطم 800 جم', 'Premium Tomato Paste', 'FINISHED', 'PCS', 1250, 10000000],
  ];
  for (const [id, code, ar, en, type, uom, cost, reorder] of items) {
    db.prepare(
      'INSERT OR IGNORE INTO items (id, code, name_ar, name_en, type, uom_code, cost_minor, reorder_point_scaled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, code, ar, en, type, uom, cost, reorder, now, now);
  }

  // Test Work Centers
  const workCenters = [
    ['wc-prep-wash', 'WC-FOOD-PREP', 'محطة الفرز والغسيل', 'Washing Station', 'FOOD_BEV', 3500, 1500, 5000000],
    ['wc-cook-kettle', 'WC-FOOD-COOK', 'غلايات التكثيف والطهي', 'Cooking Kettles', 'FOOD_BEV', 4000, 5500, 2000000],
    ['wc-fill-pack', 'WC-FOOD-PACK', 'خط التعبئة والتعقيم', 'Filling & Capping Line', 'FOOD_BEV', 3000, 4500, 3000000],
  ];
  for (const [id, code, ar, en, vert, labor, ovh, cap] of workCenters) {
    db.prepare(
      'INSERT OR IGNORE INTO work_centers (id, code, name_ar, name_en, industry_vertical, labor_rate_minor, overhead_rate_minor, capacity_per_hour_scaled, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
    ).run(id, code, ar, en, vert, labor, ovh, cap, now);
  }

  // Test Recipe
  db.prepare(
    `INSERT OR IGNORE INTO recipes (id, code, name_ar, name_en, industry_vertical, output_item_id, base_quantity_scaled, expected_yield_pct_scaled, overhead_flat_minor, version, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
  ).run(
    'rcp-tom-paste-800',
    'RCP-FB-TOM-01',
    'معجون طماطم 800 جم',
    'Tomato Paste Formula 800g',
    'FOOD_BEV',
    'itm-tomato-paste-800g',
    10000000, // 1000 units
    960000, // 96%
    15000,
    now,
    now,
  );

  // Recipe items
  db.prepare(
    'INSERT OR IGNORE INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ri-1', 'rcp-tom-paste-800', 'itm-fresh-tomato', 18000000, 50000, 'Scrap tolerance 5%');
  db.prepare(
    'INSERT OR IGNORE INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ri-2', 'rcp-tom-paste-800', 'itm-salt-foodgrade', 200000, 0, null);
  db.prepare(
    'INSERT OR IGNORE INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ri-3', 'rcp-tom-paste-800', 'itm-citric-acid', 50000, 0, null);
  db.prepare(
    'INSERT OR IGNORE INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ri-4', 'rcp-tom-paste-800', 'itm-glass-jar-800g', 10000000, 20000, 'Jar breakage 2%');

  // Recipe byproducts
  db.prepare(
    'INSERT OR IGNORE INTO recipe_byproducts (id, recipe_id, item_id, yield_quantity_scaled, salvage_value_minor, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('rb-1', 'rcp-tom-paste-800', 'itm-tomato-skin-scrap', 2500000, 15, 'Pomace');

  // Recipe routings
  db.prepare(
    'INSERT OR IGNORE INTO recipe_routings (id, recipe_id, work_center_id, step_order, name_ar, name_en, setup_time_mins, run_time_mins_scaled, labor_headcount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run('rr-1', 'rcp-tom-paste-800', 'wc-prep-wash', 1, 'غسيل وفرز', 'Washing & Sorting', 30, 1200000, 2);
  db.prepare(
    'INSERT OR IGNORE INTO recipe_routings (id, recipe_id, work_center_id, step_order, name_ar, name_en, setup_time_mins, run_time_mins_scaled, labor_headcount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run('rr-2', 'rcp-tom-paste-800', 'wc-cook-kettle', 2, 'طهي وتكثيف', 'Cooking', 45, 2400000, 1);
  db.prepare(
    'INSERT OR IGNORE INTO recipe_routings (id, recipe_id, work_center_id, step_order, name_ar, name_en, setup_time_mins, run_time_mins_scaled, labor_headcount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run('rr-3', 'rcp-tom-paste-800', 'wc-fill-pack', 3, 'تعبئة وتعقيم', 'Filling & Capping', 20, 900000, 3);
}
