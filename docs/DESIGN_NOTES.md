# The Lab (المعمل الذكي) — Design Notes & Token Architecture

## 1. Study of Reference Application (`C:\my-pos\v2`)

As specified in Section 4.2 of the project charter, the reference application was analyzed in a strictly read-only manner to understand its visual language and design tokens, without copying files or importing any code.

### Files Examined
- `C:\my-pos\v2\src\styles\tokens.css`: Core design token layer containing color palette, typography scale, spacing units, radius scale, shadows, transitions, and resets.
- `C:\my-pos\v2\src\components\AppLayout.jsx`: Root layout structure, sidebar, topbar, and viewport container.
- `C:\my-pos\v2\src\pages\Home.jsx`: Launcher dashboard, quick-launch module tiles with primary accent colors, shift status, and live KPI summary.
- `C:\my-pos\v2\src\pages\Stock.jsx`: Tabbed inventory views, dense table layouts, filter toolbars, status indicators, and modal interaction patterns.
- `C:\my-pos\v2\src\pages\FinanceHub.jsx`: Financial tables, KPI ribbons, currency presentation, and tabbed sub-modules.

### Visual Language Observations
1. **Color Palette & Dark/Light Base**:
   - Dark mode base: `#0A0F1A` (deep slate base), `#111827` (surface/cards), `#1C2537` (raised elevation), `#2C3A52` (hover states).
   - Accents: Sky Blue (`#0EA5E9`) as primary interaction color, emerald green (`#10B981`) for success, amber (`#F59E0B`) for warnings, rose red (`#EF4444`) for errors/danger, violet (`#8B5CF6`) for secondary actions.
   - Contrast borders: Subtle slate borders (`#374151` / `#4B5563`).
2. **Typography**:
   - Primary Arabic & Latin font: `IBM Plex Sans Arabic` paired with `IBM Plex Mono` for all numeric, financial, and code fields (`.num`, `[data-type="price"]`, `[data-type="quantity"]`).
   - Line height tuned for Arabic glyphs: 1.5 standard, 1.75 loose for body paragraphs to avoid clipping Arabic diacritics.
3. **Spacing & Radii**:
   - 4px baseline grid (`--space-1`: 4px, `--space-2`: 8px, `--space-3`: 12px, `--space-4`: 16px, `--space-5`: 20px, `--space-6`: 24px, `--space-8`: 32px).
   - Card corners: 10px (`--radius-md`) to 14px (`--radius-lg`); pills for badges (`--radius-pill`: 9999px).
4. **Layout & Density**:
   - Navigation rail on the right side in RTL mode (mirroring to left in LTR).
   - Dense, high-information-density tables with explicit column alignments: numbers aligned to the end (`col-num`), text aligned to the start.
   - Status chips with subtle background tints (12% opacity) and vivid solid text for rapid visual scanning.

---

## 2. The Lab Design System: "Operations & Industrial" Identity

The Lab is conceived as an industrial, manufacturing-first operations sibling to the POS, tailored specifically for process manufacturing (recipes, batch cooking, chemical blending, QC quarantine, lots, work centers).

### Differentiation Principles
1. **Industrial Tone & Density**:
   - Higher data density than consumer retail POS: compact row heights (38px–42px), crisp grid borders, explicit status chips for batch lifecycle stages (`DRAFT`, `RELEASED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
   - Dedicated Quality (QC) status chips (`QUARANTINE`, `RELEASED`, `REJECTED`, `HOLD`) with high-contrast color coding.
   - Distinctive Lot/Batch badges (`LotBadge`) styled with monospace identifiers and bidi isolation (`<bdi dir="ltr">`).
2. **Arabic-First & Strict RTL Logical Properties**:
   - Root document defaults to `lang="ar"` and `dir="rtl"`.
   - 100% adherence to CSS Logical Properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-inline-start`, `text-align: start`. No physical `left` or `right` properties are permitted, backed by `scripts/check-rtl.mjs` verification in CI.
   - Number and currency handling: Western digits (`latn`) by default with an instant switch to Eastern Arabic digits (`arab`), Gregorian and Hijri calendar support, and integer halalas formatted via standard `Intl.NumberFormat`.
3. **Dual Theme Tokens (Light & Dark)**:
   - Built on CSS custom variables with a neutral industrial slate palette.
   - Light mode provides a clean paper-like workstation appearance (`#FFFFFF` surface, `#F8FAFC` base, `#0F172A` text).
   - Dark mode provides low-glare plant-floor readability (`#0F172A` surface, `#090D16` base, `#F8FAFC` text).
4. **100% Offline Font Bundling**:
   - Local `@fontsource/ibm-plex-sans-arabic` and `@fontsource/ibm-plex-mono` embedded directly in the application bundle. No external Google Fonts CDN requests are made at runtime.
