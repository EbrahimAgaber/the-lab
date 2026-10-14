-- 001_initial_schema.sql
-- Foundational enterprise schema for The Lab (المعمل الذكي)

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
  category TEXT NOT NULL -- MASS, VOLUME, COUNT
);

-- 5. Items master
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL, -- RAW, INTERMEDIATE, FINISHED, PACKAGING
  uom_code TEXT NOT NULL REFERENCES units_of_measure(code),
  cost_minor INTEGER NOT NULL DEFAULT 0, -- Moving average cost in halalas (1 SAR = 100 halalas)
  reorder_point_scaled INTEGER NOT NULL DEFAULT 0, -- Scaled by 10,000 (4 decimals)
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
  type TEXT NOT NULL, -- WAREHOUSE, COLD_ROOM, PRODUCTION, QUARANTINE, SCRAP
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 7. Batches / Lots
CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  lot_number TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES items(id),
  manufacture_date TEXT,
  expiry_date TEXT,
  qc_status TEXT NOT NULL DEFAULT 'QUARANTINE', -- QUARANTINE, RELEASED, REJECTED
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lots_item ON lots(item_id);

-- 8. Append-only inventory movements ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL, -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, PRODUCTION_CONSUME, PRODUCTION_YIELD, SCRAP
  item_id TEXT NOT NULL REFERENCES items(id),
  lot_id TEXT NOT NULL REFERENCES lots(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  quantity_scaled INTEGER NOT NULL, -- Signed fixed-point integer (scale 10,000)
  unit_cost_minor INTEGER NOT NULL DEFAULT 0, -- Halalas
  reference_type TEXT, -- WORK_ORDER, PURCHASE_RECEIPT, STOCK_COUNT, MANUAL
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
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED
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
