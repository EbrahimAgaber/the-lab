-- 003_users_security_and_system.sql
-- Users, RBAC, Sessions, Company Setup & Numbering

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

-- ============================================================================
-- System Reference Data (Required system configuration ONLY - NO demo records)
-- ============================================================================

-- A. Standard Units of Measure
INSERT OR IGNORE INTO units_of_measure (code, name_ar, name_en, category) VALUES
  ('KG', 'كيلوجرام', 'Kilogram', 'MASS'),
  ('G', 'جرام', 'Gram', 'MASS'),
  ('L', 'لتر', 'Liter', 'VOLUME'),
  ('ML', 'مليلتر', 'Milliliter', 'VOLUME'),
  ('M', 'متر', 'Meter', 'LENGTH'),
  ('PCS', 'قطعة', 'Piece', 'COUNT'),
  ('BOX', 'صندوق', 'Box', 'COUNT'),
  ('ROLL', 'طاقة / رول', 'Roll', 'COUNT');

-- B. Default System Roles
INSERT OR IGNORE INTO roles (code, name_ar, name_en, description) VALUES
  ('ADMIN', 'مدير النظام', 'System Administrator', 'Full administrative control over all operations and security'),
  ('SUPERVISOR', 'مشرف الإنتاج', 'Production Supervisor', 'Manage recipes, release work orders, and oversee operations'),
  ('WAREHOUSE', 'أمين المستودع', 'Warehouse Keeper', 'Manage stock movements, receipts, issues, and transfers'),
  ('QC', 'مراقب الجودة', 'Quality Control Inspector', 'Inspect materials, release or reject quarantine lots'),
  ('PROCUREMENT', 'مسؤول المشتريات', 'Procurement Officer', 'Manage purchase orders, suppliers, and incoming raw deliveries'),
  ('VIEWER', 'مشاهد', 'Auditor / Viewer', 'Read-only access to records, trace logs, and reports');

-- C. Standard Capabilities for Roles
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

-- D. Default Number Sequences
INSERT OR IGNORE INTO number_sequences (doc_type, prefix, next_val, padding) VALUES
  ('WORK_ORDER', 'WO-', 1, 5),
  ('LOT', 'LT-', 1, 6),
  ('MOVEMENT', 'MOV-', 1, 6),
  ('PURCHASE_ORDER', 'PO-', 1, 5),
  ('GOODS_RECEIPT', 'GRN-', 1, 5);

-- E. Initial Empty Company Profile
INSERT OR IGNORE INTO company_profile (id, name_ar, name_en, is_setup_complete, updated_at) VALUES
  ('default', '', '', 0, '2026-10-14T00:00:00.000Z');
