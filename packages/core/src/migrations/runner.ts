import type { SqlDatabase } from '../db';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const INITIAL_SCHEMA_SQL = `
-- 1. System migrations tracking
CREATE TABLE IF NOT EXISTS sys_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- 2. Transactional audit log
CREATE TABLE IF NOT EXISTS sys_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  diff_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON sys_audit_log(entity_type, entity_id);

-- 3. Transactional Outbox
CREATE TABLE IF NOT EXISTS sys_outbox (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  published_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sys_outbox_pending ON sys_outbox(published_at) WHERE published_at IS NULL;

-- 4. Units of measure
CREATE TABLE IF NOT EXISTS units_of_measure (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL
);

-- 5. Items master
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL,
  uom_code TEXT NOT NULL REFERENCES units_of_measure(code),
  cost_minor INTEGER NOT NULL DEFAULT 0,
  reorder_point_scaled INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Warehouses & Bin locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 7. Batches / Lots
CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  lot_number TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items(id),
  manufacture_date TEXT,
  expiry_date TEXT,
  qc_status TEXT NOT NULL DEFAULT 'QUARANTINE',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lots_item ON lots(item_id);

-- 8. Append-only inventory movements ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id),
  lot_id TEXT NOT NULL REFERENCES lots(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  quantity_scaled INTEGER NOT NULL,
  unit_cost_minor INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_balance ON inventory_movements(item_id, lot_id, location_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON inventory_movements(created_at);

-- 9. Work orders (Manufacturing Execution)
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items(id),
  target_lot_id TEXT REFERENCES lots(id),
  planned_quantity_scaled INTEGER NOT NULL,
  yield_quantity_scaled INTEGER NOT NULL DEFAULT 0,
  scrap_quantity_scaled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  qc_status TEXT NOT NULL DEFAULT 'QUARANTINE',
  due_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- 10. Work order item consumptions
CREATE TABLE IF NOT EXISTS work_order_consumptions (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  lot_id TEXT NOT NULL REFERENCES lots(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  quantity_scaled INTEGER NOT NULL,
  unit_cost_minor INTEGER NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wo_consumptions ON work_order_consumptions(work_order_id);
`;

export const BOM_AND_COSTING_SQL = `
-- 1. Work Centers (Production lines, sewing stations, cutting tables, kettles)
CREATE TABLE IF NOT EXISTS work_centers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  industry_vertical TEXT NOT NULL,
  labor_rate_minor INTEGER NOT NULL DEFAULT 0,
  overhead_rate_minor INTEGER NOT NULL DEFAULT 0,
  capacity_per_hour_scaled INTEGER NOT NULL DEFAULT 10000,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 2. Recipes & Bills of Materials (BOM Headers)
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  industry_vertical TEXT NOT NULL,
  output_item_id TEXT NOT NULL REFERENCES items(id),
  base_quantity_scaled INTEGER NOT NULL DEFAULT 10000,
  expected_yield_pct_scaled INTEGER NOT NULL DEFAULT 1000000,
  overhead_flat_minor INTEGER NOT NULL DEFAULT 0,
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
  quantity_scaled INTEGER NOT NULL,
  scrap_tolerance_pct_scaled INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);

-- 4. Recipe By-Products / Co-Products
CREATE TABLE IF NOT EXISTS recipe_byproducts (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  yield_quantity_scaled INTEGER NOT NULL,
  salvage_value_minor INTEGER NOT NULL DEFAULT 0,
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
  run_time_mins_scaled INTEGER NOT NULL DEFAULT 10000,
  labor_headcount INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_recipe_routings_recipe ON recipe_routings(recipe_id, step_order);

-- 6. Link work orders to recipes
ALTER TABLE work_orders ADD COLUMN recipe_id TEXT REFERENCES recipes(id);

-- 7. Work order cost journal entries
CREATE TABLE IF NOT EXISTS work_order_cost_lines (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  cost_category TEXT NOT NULL,
  reference_id TEXT,
  standard_amount_minor INTEGER NOT NULL DEFAULT 0,
  actual_amount_minor INTEGER NOT NULL DEFAULT 0,
  variance_amount_minor INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wo_cost_lines ON work_order_cost_lines(work_order_id);
`;

export const USERS_SECURITY_AND_SYSTEM_SQL = `
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT
);

-- 3. User Roles mapping
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_code)
);

-- 4. Role Capabilities
CREATE TABLE IF NOT EXISTS role_capabilities (
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  PRIMARY KEY (role_code, capability)
);

-- 5. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 6. Company Profile & Settings
CREATE TABLE IF NOT EXISTS company_profile (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  cr_number TEXT,
  vat_number TEXT,
  base_currency TEXT NOT NULL DEFAULT 'SAR',
  vat_rate_pct INTEGER NOT NULL DEFAULT 15,
  is_setup_complete INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 7. Gapless Document Numbering Sequences
CREATE TABLE IF NOT EXISTS number_sequences (
  doc_type TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  next_val INTEGER NOT NULL DEFAULT 1,
  padding INTEGER NOT NULL DEFAULT 5
);

-- 8. Suppliers Master
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  tax_number TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);

-- System Reference Data (Required system configuration ONLY - NO demo records)
INSERT OR IGNORE INTO units_of_measure (code, name_ar, name_en, category) VALUES
  ('KG', 'كيلوجرام', 'Kilogram', 'MASS'),
  ('G', 'جرام', 'Gram', 'MASS'),
  ('L', 'لتر', 'Liter', 'VOLUME'),
  ('ML', 'مليلتر', 'Milliliter', 'VOLUME'),
  ('M', 'متر', 'Meter', 'LENGTH'),
  ('PCS', 'قطعة', 'Piece', 'COUNT'),
  ('BOX', 'صندوق', 'Box', 'COUNT'),
  ('ROLL', 'طاقة / رول', 'Roll', 'COUNT');

INSERT OR IGNORE INTO roles (code, name_ar, name_en, description) VALUES
  ('ADMIN', 'مدير النظام', 'System Administrator', 'Full administrative control over all operations and security'),
  ('SUPERVISOR', 'مشرف الإنتاج', 'Production Supervisor', 'Manage recipes, release work orders, and oversee operations'),
  ('WAREHOUSE', 'أمين المستودع', 'Warehouse Keeper', 'Manage stock movements, receipts, issues, and transfers'),
  ('QC', 'مراقب الجودة', 'Quality Control Inspector', 'Inspect materials, release or reject quarantine lots'),
  ('PROCUREMENT', 'مسؤول المشتريات', 'Procurement Officer', 'Manage purchase orders, suppliers, and incoming raw deliveries'),
  ('VIEWER', 'مشاهد', 'Auditor / Viewer', 'Read-only access to records, trace logs, and reports');

INSERT OR IGNORE INTO role_capabilities (role_code, capability) VALUES
  ('ADMIN', '*:*.*'),
  ('SUPERVISOR', 'manufacturing:*.*'),
  ('SUPERVISOR', 'catalog:*.read'),
  ('SUPERVISOR', 'inventory:*.read'),
  ('SUPERVISOR', 'reports:*.read'),
  ('WAREHOUSE', 'inventory:*.*'),
  ('WAREHOUSE', 'catalog:items.read'),
  ('WAREHOUSE', 'reports:*.read'),
  ('QC', 'quality:*.*'),
  ('QC', 'inventory:lots.read'),
  ('QC', 'inventory:lots.updateQc'),
  ('PROCUREMENT', 'procurement:*.*'),
  ('PROCUREMENT', 'catalog:suppliers.*'),
  ('PROCUREMENT', 'catalog:items.read'),
  ('VIEWER', '*:*.read');

INSERT OR IGNORE INTO number_sequences (doc_type, prefix, next_val, padding) VALUES
  ('WORK_ORDER', 'WO-', 1, 5),
  ('LOT', 'LT-', 1, 6),
  ('MOVEMENT', 'MOV-', 1, 6),
  ('PURCHASE_ORDER', 'PO-', 1, 5),
  ('GOODS_RECEIPT', 'GRN-', 1, 5);

INSERT OR IGNORE INTO company_profile (id, name_ar, name_en, is_setup_complete, updated_at) VALUES
  ('default', '', '', 0, '2026-10-14T00:00:00.000Z');
`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    sql: INITIAL_SCHEMA_SQL,
  },
  {
    version: 2,
    name: '002_bom_and_costing',
    sql: BOM_AND_COSTING_SQL,
  },
  {
    version: 3,
    name: '003_users_security_and_system',
    sql: USERS_SECURITY_AND_SYSTEM_SQL,
  },
];

export function runMigrations(db: SqlDatabase): { applied: number } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sys_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      checksum TEXT,
      applied_at TEXT NOT NULL
    );
  `);

  // Ensure checksum column exists if upgrading table
  try {
    db.exec('ALTER TABLE sys_migrations ADD COLUMN checksum TEXT;');
  } catch {
    // Column already exists
  }

  const appliedRows = db.prepare('SELECT version, checksum FROM sys_migrations').all() as {
    version: number;
    checksum: string | null;
  }[];
  const appliedMap = new Map<number, string | null>(appliedRows.map((r) => [r.version, r.checksum]));

  let appliedCount = 0;
  for (const m of MIGRATIONS) {
    if (appliedMap.has(m.version)) {
      continue;
    }

    const tx = db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO sys_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)').run(
        m.version,
        m.name,
        'v' + m.version,
        new Date().toISOString(),
      );
    });
    tx();
    appliedCount++;
  }

  return { applied: appliedCount };
}
