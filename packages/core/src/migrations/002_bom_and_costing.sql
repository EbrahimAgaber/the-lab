-- 002_bom_and_costing.sql
-- Dynamic Recipe / BOM & Cost Configuration Engine for Process (F&B) & Discrete (Textiles)

-- 1. Work Centers (Production lines, sewing stations, cutting tables, kettles)
CREATE TABLE IF NOT EXISTS work_centers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  industry_vertical TEXT NOT NULL, -- FOOD_BEV, TEXTILE, GENERAL
  labor_rate_minor INTEGER NOT NULL DEFAULT 0, -- Hourly labor rate in halalas/minor units
  overhead_rate_minor INTEGER NOT NULL DEFAULT 0, -- Hourly machine / station overhead in halalas
  capacity_per_hour_scaled INTEGER NOT NULL DEFAULT 10000, -- Default units/hr (scale 10,000)
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 2. Recipes & Bills of Materials (BOM Headers)
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  industry_vertical TEXT NOT NULL, -- FOOD_BEV, TEXTILE, GENERAL
  output_item_id TEXT NOT NULL REFERENCES items(id),
  base_quantity_scaled INTEGER NOT NULL DEFAULT 10000, -- Standard batch size (scale 10,000)
  expected_yield_pct_scaled INTEGER NOT NULL DEFAULT 1000000, -- 100.0000% (scale 10,000)
  overhead_flat_minor INTEGER NOT NULL DEFAULT 0, -- Standard fixed setup/batch overhead
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recipes_output_item ON recipes(output_item_id);

-- 3. Recipe Components / Ingredients / BOM Lines
CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  quantity_scaled INTEGER NOT NULL, -- Standard quantity required for base_quantity_scaled
  scrap_tolerance_pct_scaled INTEGER NOT NULL DEFAULT 0, -- e.g. 50000 = 5.0000% allowable scrap
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);

-- 4. Recipe By-Products / Co-Products (Common in F&B, dairy, oil extraction)
CREATE TABLE IF NOT EXISTS recipe_byproducts (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  yield_quantity_scaled INTEGER NOT NULL,
  salvage_value_minor INTEGER NOT NULL DEFAULT 0, -- Offsets production cost
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipe_byproducts_recipe ON recipe_byproducts(recipe_id);

-- 5. Recipe Routings / Operational Stages
CREATE TABLE IF NOT EXISTS recipe_routings (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  work_center_id TEXT NOT NULL REFERENCES work_centers(id),
  step_order INTEGER NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  setup_time_mins INTEGER NOT NULL DEFAULT 0,
  run_time_mins_scaled INTEGER NOT NULL DEFAULT 10000, -- Time in minutes scaled per base unit
  labor_headcount INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_recipe_routings_recipe ON recipe_routings(recipe_id, step_order);

-- 6. Link work orders to recipes
ALTER TABLE work_orders ADD COLUMN recipe_id TEXT REFERENCES recipes(id);

-- 7. Work order cost journal entries (Standard vs Actual financial ledger)
CREATE TABLE IF NOT EXISTS work_order_cost_lines (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  cost_category TEXT NOT NULL, -- MATERIAL_DIRECT, LABOR_DIRECT, MACHINE_OVERHEAD, BYPRODUCT_CREDIT, SCRAP_LOSS
  reference_id TEXT, -- e.g. item_id or work_center_id
  standard_amount_minor INTEGER NOT NULL DEFAULT 0,
  actual_amount_minor INTEGER NOT NULL DEFAULT 0,
  variance_amount_minor INTEGER NOT NULL DEFAULT 0, -- actual - standard
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wo_cost_lines ON work_order_cost_lines(work_order_id);
