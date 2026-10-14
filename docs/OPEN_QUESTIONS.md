# Open Questions & Trade-offs (الأسئلة والقرارات المفتوحة)

This document records architectural, product, and scope questions along with their working decisions and defaults as established in the Production Readiness Plan.

## Resolved Defaults (Decisions D1–D8)

| ID | Topic | Working Decision | Rationale |
|---|---|---|---|
| D1 | Deployment Architecture | Windows Desktop application with local embedded SQLite; core designed host-agnostic for LAN server mode in v1.1. | No external database dependency; zero cloud requirement for factory floor operations. SQLite files are never shared across network drives. |
| D2 | Dev / Browser Mode | Node/Vite host executing the identical core services and RPC contract over HTTP `/rpc`. | Eliminates diverging client-side mocks; single source of truth. |
| D3 | Industry Verticals | Process manufacturing (Food & Beverage + General Chemical/Process). Discrete manufacturing (textile cut-and-sew) deferred. | Focuses v1 on deep excellence for recipe/formula, lot-tracking, batch costing, and expiry. |
| D4 | Operating System | Windows 10/11 x64 target first, code remains cross-platform. | Primary target OS on factory floor touch PCs and management terminals. |
| D5 | Bilingual Parity | Arabic-first default, full English parity, verified by automated key parity test. | Localized for Saudi & Arab world manufacturers with full English accessibility. |
| D6 | Currency & Tax | SAR default (customizable at setup), 15% VAT on procurement only. | Clean accounting separation without out-of-scope ZATCA e-invoicing. |
| D7 | POS Integration | Out of scope for v1 core. Export/Import templates provided via outbox and CSV. | Keeps v1 focused on factory/manufacturing execution. |
| D8 | Licensing | Clean interface seam without hard blocking in v1. | Allows clean integration later without polluting core domain logic. |

## Open Items & Review Notes

1. **Barcode Scanner Format:** Support keyboard-wedge hardware input natively on shop-floor screens.
2. **Offline Local Printer Setup:** Standard 80mm thermal receipt / lot label printer vs standard A4 PDF document printing.
