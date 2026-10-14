PRAGMA foreign_keys = ON;

ALTER TABLE items ADD COLUMN selling_price_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN min_stock_scaled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN lead_time_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE items ADD COLUMN gsm_weight INTEGER;
ALTER TABLE items ADD COLUMN roll_width_cm INTEGER;
ALTER TABLE items ADD COLUMN weave_construction TEXT;
ALTER TABLE items ADD COLUMN fiber_composition TEXT;
ALTER TABLE items ADD COLUMN default_shrinkage_pct_scaled INTEGER DEFAULT 0;

ALTER TABLE lots ADD COLUMN parent_lot_id TEXT REFERENCES lots(id);
ALTER TABLE lots ADD COLUMN roll_barcode TEXT;
ALTER TABLE lots ADD COLUMN dye_lot_code TEXT;
ALTER TABLE lots ADD COLUMN shade_group TEXT;
ALTER TABLE lots ADD COLUMN roll_length_meters_scaled INTEGER;
ALTER TABLE lots ADD COLUMN roll_width_cm INTEGER;
ALTER TABLE lots ADD COLUMN actual_gsm INTEGER;
ALTER TABLE lots ADD COLUMN supplier_id TEXT REFERENCES suppliers(id);

CREATE INDEX IF NOT EXISTS idx_lots_dye_shade ON lots(item_id, dye_lot_code, shade_group);
CREATE INDEX IF NOT EXISTS idx_lots_roll_barcode ON lots(roll_barcode);

CREATE TABLE IF NOT EXISTS work_order_routing_steps (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    recipe_routing_id TEXT REFERENCES recipe_routings(id),
    work_center_id TEXT NOT NULL REFERENCES work_centers(id),
    step_order INTEGER NOT NULL,
    stage_code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'SKIPPED')),
    planned_setup_mins INTEGER NOT NULL DEFAULT 0,
    planned_run_mins INTEGER NOT NULL DEFAULT 0,
    actual_setup_mins INTEGER NOT NULL DEFAULT 0,
    actual_run_mins INTEGER NOT NULL DEFAULT 0,
    downtime_mins INTEGER NOT NULL DEFAULT 0,
    input_quantity_scaled INTEGER NOT NULL DEFAULT 0,
    good_output_scaled INTEGER NOT NULL DEFAULT 0,
    scrap_output_scaled INTEGER NOT NULL DEFAULT 0,
    rework_output_scaled INTEGER NOT NULL DEFAULT 0,
    operator_user_id TEXT REFERENCES users(id),
    started_at TEXT,
    completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(work_order_id, step_order)
  );

CREATE INDEX IF NOT EXISTS idx_wo_steps_wo ON work_order_routing_steps(work_order_id, step_order);
CREATE INDEX IF NOT EXISTS idx_wo_steps_wc ON work_order_routing_steps(work_center_id, status);

CREATE TABLE IF NOT EXISTS work_center_downtime_logs (
    id TEXT PRIMARY KEY,
    work_center_id TEXT NOT NULL REFERENCES work_centers(id),
    work_order_id TEXT REFERENCES work_orders(id),
    routing_step_id TEXT REFERENCES work_order_routing_steps(id),
    category TEXT NOT NULL
      CHECK (category IN ('PLANNED_MAINTENANCE', 'CHANGEOVER', 'MECHANICAL_FAILURE', 'YARN_BREAKAGE', 'MATERIAL_SHORTAGE', 'QUALITY_HOLD', 'POWER_UTILITY')),
    is_planned INTEGER NOT NULL DEFAULT 0 CHECK (is_planned IN (0, 1)),
    duration_mins INTEGER NOT NULL CHECK (duration_mins >= 0),
    reason_ar TEXT NOT NULL,
    reason_en TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE INDEX IF NOT EXISTS idx_downtime_wc ON work_center_downtime_logs(work_center_id, started_at);

CREATE TABLE IF NOT EXISTS work_order_cut_plans (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    fabric_item_id TEXT NOT NULL REFERENCES items(id),
    dye_lot_code TEXT,
    shade_group TEXT,
    marker_length_meters_scaled INTEGER NOT NULL,
    marker_width_cm INTEGER NOT NULL,
    marker_efficiency_pct_scaled INTEGER NOT NULL,
    shrinkage_allowance_pct_scaled INTEGER NOT NULL DEFAULT 0,
    planned_plies INTEGER NOT NULL CHECK (planned_plies > 0),
    actual_plies INTEGER NOT NULL DEFAULT 0,
    net_fabric_required_scaled INTEGER NOT NULL,
    gross_fabric_required_scaled INTEGER NOT NULL,
    actual_fabric_consumed_scaled INTEGER NOT NULL DEFAULT 0,
    end_bit_waste_scaled INTEGER NOT NULL DEFAULT 0,
    pieces_per_lay INTEGER NOT NULL DEFAULT 1,
    total_pieces_cut INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE INDEX IF NOT EXISTS idx_cut_plans_wo ON work_order_cut_plans(work_order_id);

CREATE TABLE IF NOT EXISTS quality_inspections (
    id TEXT PRIMARY KEY,
    inspection_number TEXT NOT NULL UNIQUE,
    lot_id TEXT NOT NULL REFERENCES lots(id),
    work_order_id TEXT REFERENCES work_orders(id),
    inspector_user_id TEXT REFERENCES users(id),
    inspection_type TEXT NOT NULL DEFAULT 'FOUR_POINT_FABRIC'
      CHECK (inspection_type IN ('INCOMING_RAW', 'IN_PROCESS_LINE', 'FOUR_POINT_FABRIC', 'FINAL_GARMENT_AQL')),
    inspected_length_meters_scaled INTEGER NOT NULL DEFAULT 0,
    inspected_width_cm INTEGER NOT NULL DEFAULT 150,
    target_gsm INTEGER,
    measured_gsm INTEGER,
    warp_shrinkage_pct_scaled INTEGER DEFAULT 0,
    weft_shrinkage_pct_scaled INTEGER DEFAULT 0,
    color_fastness_grade INTEGER CHECK (color_fastness_grade IS NULL OR (color_fastness_grade BETWEEN 1 AND 5)),
    shade_match_status TEXT DEFAULT 'PASS' CHECK (shade_match_status IN ('PASS', 'MARGINAL', 'FAIL')),
    total_penalty_points INTEGER NOT NULL DEFAULT 0,
    points_per_100_sqm_scaled INTEGER NOT NULL DEFAULT 0,
    max_allowed_points_100_sqm_scaled INTEGER NOT NULL DEFAULT 200000,
    disposition TEXT NOT NULL DEFAULT 'QUARANTINE'
      CHECK (disposition IN ('QUARANTINE', 'RELEASED', 'SECOND_GRADE', 'REWORK', 'REJECTED')),
    notes TEXT,
    inspected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS quality_defect_entries (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
    defect_code TEXT NOT NULL,
    defect_name_ar TEXT NOT NULL,
    defect_name_en TEXT NOT NULL,
    meter_position_scaled INTEGER,
    defect_size_inches_scaled INTEGER,
    penalty_points INTEGER NOT NULL CHECK (penalty_points IN (1, 2, 3, 4)),
    is_major INTEGER NOT NULL DEFAULT 0 CHECK (is_major IN (0, 1)),
    notes TEXT
  );

CREATE INDEX IF NOT EXISTS idx_qc_inspections_lot ON quality_inspections(lot_id);
CREATE INDEX IF NOT EXISTS idx_qc_defects_insp ON quality_defect_entries(inspection_id);

INSERT OR IGNORE INTO number_sequences (sequence_type, prefix, next_value, padding_length)
VALUES ('QC', 'QC-', 1, 5);

INSERT OR IGNORE INTO units_of_measure (code, name_ar, name_en, category) VALUES
  ('SQM', 'مر مربع', 'Square Meter', 'AREA'),
  ('YD',  'ياردة',     'Yard',         'LENGTH'),
  ('CONE','ونة خيط',  'Yarn Cone',    'COUNT'),
  ('BALE','بالة',      'Cotton Bale',  'WEIGHT');
