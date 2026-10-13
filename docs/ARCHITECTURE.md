# The Lab (المعمل الذكي) — Technical Architecture

## 1. System Overview & Monorepo Topology

The Lab is an independent, offline-first manufacturing and enterprise operations application engineered for process and batch manufacturers (food production, central kitchens, cosmetics, chemical formulations). It executes with zero external cloud dependencies.

```
c:\the-lab\
├── apps\
│   └── desktop\              # Thin Electron shell (main process, IPC bridge, window management)
├── packages\
│   ├── core\                 # Headless TypeScript core: zero DOM/React/Electron dependencies
│   │   ├── src\
│   │   │   ├── db.ts         # SQLite WAL connection factory with driver injection
│   │   │   └── runtime.ts    # Service kernel, RBAC enforcement, and audit transactions
│   │   └── test\             # Pure Node.js vitest suite running without native rebuild issues
│   └── ui\                   # Arabic-first React + Vite UI (design tokens, components, pages)
├── docs\                     # Architecture, decisions, design notes, integration contracts, screenshots
└── scripts\                  # Tooling (check-rtl.mjs lint, screenshot capture)
```

### Dependency Decoupling
- **`packages/core`**: Contains all business logic, validation, calculations, ledger manipulations, and SQLite queries. It exposes plain TypeScript interfaces. It can run in Node.js, Electron main process, or CLI runners without modification.
- **`packages/ui`**: Contains React components, design system tokens, RTL layout logic, and i18n hooks. It communicates with the core through an injected API interface (`window.labApi` in desktop or a local mock in browser development).
- **`apps/desktop`**: Thin Electron wrapper that boots SQLite via `@the-lab/core`, establishes an IPC handler, and displays the UI in a secure `BrowserWindow` with `contextIsolation: true`.

---

## 2. Database Architecture & Electron ABI Management

### Database Engine
- **Engine**: SQLite 3 via `better-sqlite3`.
- **Operating Mode**: Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) for maximum concurrency and non-blocking reads during batch operations.
- **Foreign Keys**: Enabled (`PRAGMA foreign_keys = ON;`).
- **Synchronous**: Normal mode (`PRAGMA synchronous = NORMAL;`) for high write throughput while maintaining durability.

### Electron ABI Mismatch Handling
A common pain point in Electron + SQLite projects is Node.js vs Electron native ABI mismatch for C++ addons (`better-sqlite3`). The Lab solves this deterministically:
1. **Core Testing**: All tests in `packages/core` execute in standard Node.js (`node >= 22`) via `vitest`. The installed `better-sqlite3` binary matches the local Node runtime (`node-v127-win32-x64`).
2. **Desktop Shell Strategy**:
   - In production or packaged Electron builds, Electron's `electron-builder` or `@electron/rebuild` builds or downloads the corresponding Electron ABI (`node-v130-win32-x64` for Electron 33).
   - In development mode, `ELECTRON_RUN_AS_NODE=1` allows running database migration or test scripts using Electron's bundled Node binary, ensuring 100% ABI alignment without double-compilation.
   - For UI-only development, `packages/ui` can run under `npm run dev` with Vite's dev server, consuming in-memory seed data or IPC mock adapters.

---

## 3. Inventory Movement Ledger & Valuation

### Append-Only Invariant
Inventory in The Lab is modeled strictly as an immutable append-only movement ledger. **Quantities are never updated in place on item records.**
- An item's physical balance at any point in time is the deterministic sum of all signed movement quantities for that `(item_id, lot_id, location_id)` tuple:
  $$\text{Balance} = \sum_{i} \Delta Q_i$$
- When an optional balance cache table is introduced for read performance, it is disposable and fully reconstructible by replaying the ledger. Any discrepancy between the cache and the movement sum fails invariant assertions.

### Movement Types
- `RECEIPT`: Goods received from supplier purchase order into quarantine or raw materials storage.
- `ISSUE`: Goods issued out of stock (e.g. sample disposal, external dispatch).
- `TRANSFER`: Two-legged movement moving inventory between warehouse locations or work centers.
- `ADJUSTMENT`: Cycle count or physical count variance reconciliation with mandatory audit reason.
- `PRODUCTION_CONSUME`: Raw material or packaging depletion linked to an active Work Order batch.
- `PRODUCTION_YIELD`: Finished or semi-finished product lot creation from Work Order completion.
- `SCRAP`: Defective materials or batch waste discarded during manufacturing.

### Ledger Record Schema
Each movement record contains:
- `id`: UUIDv7 or monotonic sequence ID.
- `item_id`: Reference to master item.
- `lot_id`: Reference to specific batch lot (with manufacturing date, expiry date, and QC status).
- `location_id`: Reference to warehouse bin or work center.
- `quantity`: Signed fixed-scale integer (see Numeric Strategy).
- `unit_cost_minor`: Cost per unit stored as integer halalas.
- `reference_type`: Entity causing the movement (`WORK_ORDER`, `PURCHASE_RECEIPT`, `STOCK_COUNT`, `TRANSFER_ORDER`).
- `reference_id`: Identifier of the source document.
- `actor_id`: User initiating the transaction.
- `idempotency_key`: Unique string token preventing duplicate submissions on retried network or UI events.
- `created_at`: Deterministic ISO timestamp.

### Inventory Valuation: Moving Weighted-Average Cost
Valuation is maintained using perpetual moving weighted-average cost (WAC):
$$\bar{C}_{\text{new}} = \frac{(Q_{\text{prev}} \times \bar{C}_{\text{prev}}) + (Q_{\text{received}} \times C_{\text{receipt}})}{Q_{\text{prev}} + Q_{\text{received}}}$$
- Negative stock is rejected by default unless explicit branch-level emergency override is configured.

---

## 4. Numeric Strategy: Money and Quantities

### Zero Floating Point Storage
Floating point math (`0.1 + 0.2 === 0.30000000000000004`) is strictly forbidden for financial and quantity persistence.

1. **Money (Integer Minor Units)**:
   - Stored as integer halalas (1 SAR = 100 halalas).
   - Type in TypeScript: `bigint` or safe `number` integer.
   - Formatting: Converted to decimal display string only at the UI boundary using `Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR' })`.
2. **Quantities (Fixed-Scale Fixed Point)**:
   - Quantities are stored with a documented fixed scale of 4 decimal places (e.g., $1.2500\text{ kg} \to 12500$ minor quantity units) or normalized string fixed-point.
   - Rounding rule: **Half-up rounding** (`BigInt` integer arithmetic with remainder evaluation: if $2 \times \text{remainder} \ge \text{divisor}$, add 1 to quotient).
   - Conversion between Units of Measure (e.g., 1 Box = 24 Pieces, 1 kg = 1000 g) uses exact integer ratios `(numerator / denominator)` to avoid accumulated drift.

---

## 5. Security & Capability-Based RBAC

Access control is governed by granular capabilities rather than static broad roles:
- Format: `<module>:<resource>.<action>` (e.g., `inventory:movements.create`, `manufacturing:work_orders.release`, `qc:inspections.approve`).
- Capabilities are validated in the **headless core service layer** before any transaction begins; UI visibility toggles are convenience-only and not security barriers.
- Seed Roles:
  - **Admin**: All capabilities (`*:*.*`).
  - **Production Supervisor**: Manufacturing, BOM management, recipe execution, shortage analysis.
  - **Warehouse Keeper**: Inventory movements, transfers, receipts, stock count recording.
  - **QC Inspector**: Quality specs, quarantine releases, defect logging, Certificate of Analysis creation.
  - **Procurement Officer**: Requisitions, purchase orders, vendor goods receipts.
  - **Viewer**: Read-only capabilities across active modules.

---

## 6. Atomic Transactional Audit Logging

Every state-changing operation in `@the-lab/core` executes within an atomic SQLite transaction:
```sql
BEGIN IMMEDIATE TRANSACTION;
-- 1. Validate caller capability and business preconditions
-- 2. Execute business mutations (e.g., insert stock movement)
-- 3. Insert audit log record (actor_id, action, entity_type, entity_id, diff_json, timestamp)
COMMIT;
```
If any step fails, the entire transaction rolls back. It is architecturally impossible to have a business mutation without its corresponding audit entry.

---

## 7. Modular Kernel & Registry Lifecycle

1. All domain modules (`manufacturing`, `quality`, `procurement`, `traceability`, `planning`, `finance_bridge`) register through a central kernel `ModuleRegistry`.
2. **Safety Invariant**: Disabling a module hides its routes and navigation in the UI, but **never deletes underlying tables or historical data**.
3. **Open Work Guard**: A module with active or open commitments (e.g. a Work Order in `IN_PROGRESS` or a PO awaiting receipt) **cannot be disabled**. Any attempt throws an `OpenWorkExistsError` detailing the blocking entities.
4. **Database Migrations**: Forward-only, versioned, namespaced per module (`migrations/kernel/001_initial.sql`, `migrations/manufacturing/001_work_orders.sql`).
