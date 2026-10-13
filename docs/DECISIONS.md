# The Lab (المعمل الذكي) — Architecture Decision Records (ADR)

This document tracks all foundational architectural decisions, rationales, and evaluated alternatives for The Lab.

---

## ADR-001: Monorepo Structure with Headless Core
- **Context**: The application must run as a standalone desktop operations suite, with isolated business logic testable under plain Node.js and a modular React UI.
- **Decision**: Split the repository into `packages/core` (pure TypeScript, zero DOM/Electron imports, SQLite driver injected), `packages/ui` (Vite + React with RTL-first layout), and `apps/desktop` (thin Electron shell).
- **Why**: Keeps business logic and inventory ledger calculations completely decoupled from UI presentation and Electron lifecycle. Tests run in milliseconds under pure Node without Electron harness overhead.
- **Alternatives Considered**:
  - Single combined Electron-Vite project: Rejected due to tangled business logic with React hooks and slow native test runs.
  - Separate repositories: Rejected due to maintenance overhead and version drift across core types and UI.

---

## ADR-002: SQLite WAL Mode via better-sqlite3 with Injected Connection
- **Context**: An industrial manufacturing floor requires reliable local storage with high write concurrency for batch movements and audit trails, without cloud latency or failure points.
- **Decision**: Use SQLite 3 via `better-sqlite3` configured with Write-Ahead Logging (`WAL`), `synchronous = NORMAL`, and foreign key enforcement. Connection factory is injected into core services.
- **Why**: SQLite in WAL mode allows concurrent readers while a write transaction executes, providing millisecond response times and zero-configuration offline stability.
- **Alternatives Considered**:
  - Embedded DuckDB: Excellent for OLAP analytics but not suited for high-frequency transactional ledger mutations and foreign-key constraints.
  - Client-side IndexedDB: Insufficient transactional guarantees and difficult to run headless invariant tests in pure Node.js.

---

## ADR-003: Electron Native ABI Mismatch Strategy
- **Context**: Native Node C++ addons compiled for Node.js (ABI 127 on Node 22) fail to load in Electron runtimes (ABI 130 on Electron 33) unless handled systematically.
- **Decision**:
  1. `packages/core` tests run directly against Node 22 with standard `better-sqlite3` prebuilds.
  2. In development or build scripts for the Electron shell, utilize `ELECTRON_RUN_AS_NODE` or targeted rebuild scripts.
  3. UI development runs via Vite dev server against mocked or headless Node endpoints.
- **Why**: Developers can run `npm test` with a single command without triggering expensive C++ compilation passes or requiring Microsoft Visual C++ Build Tools on every developer machine.
- **Alternatives Considered**:
  - Compiling SQLite with WASM (`sql.js`): Avoids native binaries but suffers substantial performance degradation on large ledger aggregations and lacks true file-system WAL locking.

---

## ADR-004: Append-Only Delta Ledger for Inventory Movements
- **Context**: Inventory counts in manufacturing are subject to audits, batch recalls, and valuation reviews. Overwriting quantities in place loses provenance and leads to reconciliation bugs.
- **Decision**: Treat stock as an immutable, append-only ledger of movements (`RECEIPT`, `ISSUE`, `TRANSFER`, `ADJUSTMENT`, `PRODUCTION_CONSUME`, `PRODUCTION_YIELD`, `SCRAP`). Current balances are derived by aggregating signed deltas.
- **Why**: Complete audit trail, zero phantom stock overwrites, deterministic time-travel inventory queries, and automatic support for batch traceability.
- **Alternatives Considered**:
  - Current-quantity balance table with audit trigger: Error-prone during race conditions and rollback anomalies; fails to provide mathematical proof of balance derivation.

---

## ADR-005: Fixed-Scale Money (Halalas) and Quantities
- **Context**: Floating-point rounding errors in financial and batch manufacturing calculations cause ledger imbalances and inventory reconciliation drift.
- **Decision**:
  - Money is stored exclusively as integer minor units (halalas, 1 SAR = 100 halalas).
  - Quantities are stored as fixed-scale integers (4 decimal places: 1.0000 = 10,000 units) or exact fractional ratios for unit conversions.
  - Rounding uses half-up integer division (`(value + divisor / 2) / divisor`).
- **Why**: Eliminates all IEEE 754 precision issues; guarantees mathematical invariance across valuation layers.
- **Alternatives Considered**:
  - IEEE-754 `Number` floating point: Rejected due to precision errors (`0.1 + 0.2 != 0.3`).
  - Third-party `bignumber.js` or `decimal.js` for DB persistence: Unnecessary dependency overhead; native `BigInt` provides maximum speed and deterministic SQLite integer storage.

---

## ADR-006: Arabic-First RTL Layout using CSS Logical Properties
- **Context**: Operations staff and plant supervisors in Saudi Arabia operate Arabic-first. Traditional LTR designs converted to RTL often suffer from broken alignment, hardcoded margins, and inverted icons.
- **Decision**:
  - Default document state: `lang="ar"`, `dir="rtl"`.
  - Enforce CSS Logical Properties exclusively (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`).
  - Automated CI script `scripts/check-rtl.mjs` fails if physical direction keywords (`margin-left`, `right:`, etc.) are detected.
  - Monospace font and `<bdi dir="ltr">` isolation for lot numbers, SKUs, and currency figures.
- **Why**: Flawless bi-directional switching at runtime without CSS duplication or physical overrides.
- **Alternatives Considered**:
  - CSS-in-JS RTL flippers: Add runtime overhead and unpredictable hydration mismatches.
  - Hardcoded dual CSS stylesheets (`app-rtl.css` / `app-ltr.css`): High maintenance cost and drift vulnerability.

---

## ADR-007: Capability-Based RBAC Enforced in Core Service Layer
- **Context**: User roles in manufacturing operations require granular permissions (e.g. QC inspectors can release lots but cannot modify recipes; operators can record consumption but cannot adjust ledger).
- **Decision**: Define permissions as granular strings (`<module>:<resource>.<action>`). Every core service method checks caller capabilities against an injected Security Context before opening a database transaction.
- **Why**: UI-only route guards can be bypassed; enforcing capabilities in the core ensures security regardless of whether operations are invoked via UI, IPC, or background jobs.
- **Alternatives Considered**:
  - Simple role strings (`role === 'admin'`): Too coarse; cannot express delegated duties in cross-functional manufacturing teams.
