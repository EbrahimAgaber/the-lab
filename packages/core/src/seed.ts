import type { SqlDatabase } from './db';
import type { Clock, IdGenerator } from './runtime';
import { InventoryService } from './services/inventory';
import { WorkOrderService } from './services/work-orders';

export function seedInitialData(
  db: SqlDatabase,
  clock: Clock,
  ids: IdGenerator,
): { seeded: boolean } {
  // If recipes already exist, check if we need to return
  const existingRecipes = db.prepare('SELECT COUNT(*) as cnt FROM recipes').get() as { cnt: number };
  if (existingRecipes && existingRecipes.cnt > 0) {
    return { seeded: false };
  }

  const invService = new InventoryService(db, clock, ids);
  const woService = new WorkOrderService(db, clock, ids);
  const ctx = { actorId: 'usr-system-seed' };

  // 1. Units of Measure
  const uoms = [
    { code: 'KG', ar: 'كيلوجرام', en: 'Kilogram', cat: 'MASS' },
    { code: 'G', ar: 'جرام', en: 'Gram', cat: 'MASS' },
    { code: 'L', ar: 'لتر', en: 'Liter', cat: 'VOLUME' },
    { code: 'ML', ar: 'مليلتر', en: 'Milliliter', cat: 'VOLUME' },
    { code: 'M', ar: 'متر', en: 'Meter', cat: 'COUNT' },
    { code: 'PCS', ar: 'قطعة', en: 'Piece', cat: 'COUNT' },
    { code: 'BOX', ar: 'صندوق', en: 'Box', cat: 'COUNT' },
    { code: 'ROLL', ar: 'طاقة / رول', en: 'Roll', cat: 'COUNT' },
  ];
  for (const u of uoms) {
    db.prepare(
      'INSERT OR IGNORE INTO units_of_measure (code, name_ar, name_en, category) VALUES (?, ?, ?, ?)',
    ).run(u.code, u.ar, u.en, u.cat);
  }

  // 2. Locations
  const locations = [
    { id: 'loc-raw-main', code: 'LOC-RAW', ar: 'مستودع المواد الخام', en: 'Raw Warehouse', type: 'WAREHOUSE' },
    { id: 'loc-cold-room', code: 'LOC-COLD', ar: 'غرفة التبريد المركزية', en: 'Central Cold Room', type: 'COLD_ROOM' },
    { id: 'loc-textile-mat', code: 'LOC-TEX-RAW', ar: 'مستودع الأقمشة والغزول', en: 'Textile Fabric Warehouse', type: 'WAREHOUSE' },
    { id: 'loc-prod-line-1', code: 'LOC-PRD-1', ar: 'خط الإنتاج والطبخ 1', en: 'Food Cooking Line 1', type: 'PRODUCTION' },
    { id: 'loc-sewing-floor', code: 'LOC-SEW-1', ar: 'صالة القص والحياكة', en: 'Cutting & Sewing Floor', type: 'PRODUCTION' },
    { id: 'loc-fg-main', code: 'LOC-FG', ar: 'مستودع المنتجات النهائية', en: 'Finished Goods Warehouse', type: 'WAREHOUSE' },
    { id: 'loc-scrap-bay', code: 'LOC-SCRAP', ar: 'منطقة الهدر والتوالف', en: 'Scrap & Waste Area', type: 'SCRAP' },
  ];
  for (const l of locations) {
    db.prepare(
      'INSERT OR IGNORE INTO locations (id, code, name_ar, name_en, type) VALUES (?, ?, ?, ?, ?)',
    ).run(l.id, l.code, l.ar, l.en, l.type);
  }

  // 3. Work Centers
  const workCenters = [
    // F&B Stations
    { id: 'wc-prep-wash', code: 'WC-FOOD-PREP', ar: 'محطة الفرز والغسيل', en: 'Washing & Sorting Station', vert: 'FOOD_BEV', labor: 3500, overhead: 1500, cap: 5000000 },
    { id: 'wc-cook-kettle', code: 'WC-FOOD-COOK', ar: 'غلايات التكثيف والطهي', en: 'Industrial Cooking Kettles', vert: 'FOOD_BEV', labor: 4000, overhead: 5500, cap: 2000000 },
    { id: 'wc-fill-pack', code: 'WC-FOOD-PACK', ar: 'خط التعبئة والتعقيم', en: 'Sterile Filling & Capping Line', vert: 'FOOD_BEV', labor: 3000, overhead: 4500, cap: 3000000 },
    // Textile Stations
    { id: 'wc-tex-cutting', code: 'WC-TEX-CUT', ar: 'طاولة القص بالليزر الآلية', en: 'Automated Laser Cutting Table', vert: 'TEXTILE', labor: 4500, overhead: 3000, cap: 1500000 },
    { id: 'wc-tex-sewing', code: 'WC-TEX-SEW', ar: 'خط الحياكة والتجميع', en: 'Precision Sewing Assembly Line', vert: 'TEXTILE', labor: 3800, overhead: 1200, cap: 800000 },
    { id: 'wc-tex-press', code: 'WC-TEX-FINISH', ar: 'محطة الكي والفحص والتغليف', en: 'Pressing, QC & Packing Station', vert: 'TEXTILE', labor: 3000, overhead: 1000, cap: 1200000 },
  ];
  for (const wc of workCenters) {
    db.prepare(
      `INSERT OR IGNORE INTO work_centers (id, code, name_ar, name_en, industry_vertical, labor_rate_minor, overhead_rate_minor, capacity_per_hour_scaled, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '2026-10-14T00:00:00Z')`,
    ).run(wc.id, wc.code, wc.ar, wc.en, wc.vert, wc.labor, wc.overhead, wc.cap);
  }

  // 4. Items (F&B and Textiles)
  const items = [
    // F&B Raw & Packaging
    { id: 'itm-fresh-tomato', code: 'RAW-TOM-01', ar: 'طماطم طازجة صنف أ', en: 'Fresh Tomatoes Grade A', type: 'RAW', uom: 'KG', cost: 250, reorder: 5000000 },
    { id: 'itm-salt-foodgrade', code: 'RAW-SLT-01', ar: 'ملح طعام نقي', en: 'Food Grade Salt', type: 'RAW', uom: 'KG', cost: 80, reorder: 1000000 },
    { id: 'itm-citric-acid', code: 'RAW-CIT-01', ar: 'حمض الستريك الغذائي', en: 'Food Grade Citric Acid', type: 'RAW', uom: 'KG', cost: 600, reorder: 500000 },
    { id: 'itm-glass-jar-800g', code: 'PKG-JAR-800', ar: 'مرطبان زجاجي 800 جم مع غطاء', en: 'Glass Jar 800g with Lid', type: 'PACKAGING', uom: 'PCS', cost: 120, reorder: 20000000 },
    // F&B By-product & Finished
    { id: 'itm-tomato-skin-scrap', code: 'BYP-TOM-SKIN', ar: 'تفل وقشور الطماطم (علف)', en: 'Tomato Pomace (By-product)', type: 'INTERMEDIATE', uom: 'KG', cost: 20, reorder: 0 },
    { id: 'itm-tomato-paste-800g', code: 'FG-TOM-800', ar: 'معجون طماطم فاخر 800 جم', en: 'Premium Tomato Paste 800g', type: 'FINISHED', uom: 'PCS', cost: 1250, reorder: 10000000 },

    // Textile Raw & Trims
    { id: 'itm-cotton-fabric-navy', code: 'RAW-FAB-NVY', ar: 'قماش قطن مصري 100% - كحلي', en: 'Egyptian Cotton Fabric - Navy', type: 'RAW', uom: 'M', cost: 2800, reorder: 3000000 },
    { id: 'itm-thread-poly-navy', code: 'RAW-THRD-NVY', ar: 'بكرة خيط بوليستر صناعي كحلي', en: 'Industrial Polyester Thread Navy', type: 'RAW', uom: 'PCS', cost: 450, reorder: 2000000 },
    { id: 'itm-buttons-shell', code: 'TRM-BTN-MOP', ar: 'أزرار صدفية طبيعية 12 مم', en: 'Mother of Pearl Buttons 12mm', type: 'RAW', uom: 'PCS', cost: 35, reorder: 50000000 },
    { id: 'itm-poly-garment-bag', code: 'PKG-BAG-01', ar: 'كيس تغليف قمصان شفاف', en: 'Clear Shirt Polybag', type: 'PACKAGING', uom: 'PCS', cost: 40, reorder: 10000000 },
    // Textile Finished
    { id: 'itm-shirt-oxford-l', code: 'FG-SHRT-NVY-L', ar: 'قميص أكسفورد قطن كحلي مقاس L', en: 'Oxford Cotton Shirt - Navy / L', type: 'FINISHED', uom: 'PCS', cost: 8900, reorder: 1500000 },
  ];

  for (const it of items) {
    db.prepare(
      `INSERT OR IGNORE INTO items (id, code, name_ar, name_en, type, uom_code, cost_minor, reorder_point_scaled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z')`,
    ).run(it.id, it.code, it.ar, it.en, it.type, it.uom, it.cost, it.reorder);
  }

  // 5. Lots & Initial stock
  const lots = [
    { id: 'lot-tom-01', num: 'LT-TOM-2610-01', itm: 'itm-fresh-tomato', mfg: '2026-10-10', exp: '2026-11-10', qc: 'RELEASED' },
    { id: 'lot-tom-q02', num: 'LT-TOM-2610-Q02', itm: 'itm-fresh-tomato', mfg: '2026-10-13', exp: '2026-11-13', qc: 'QUARANTINE' },
    { id: 'lot-slt-01', num: 'LT-SLT-2610-01', itm: 'itm-salt-foodgrade', mfg: '2026-09-01', exp: '2028-09-01', qc: 'RELEASED' },
    { id: 'lot-cit-01', num: 'LT-CIT-2610-01', itm: 'itm-citric-acid', mfg: '2026-08-01', exp: '2028-08-01', qc: 'RELEASED' },
    { id: 'lot-jar-01', num: 'LT-JAR-2610-01', itm: 'itm-glass-jar-800g', mfg: '2026-08-15', exp: null, qc: 'RELEASED' },
    { id: 'lot-fab-01', num: 'LT-FAB-NVY-01', itm: 'itm-cotton-fabric-navy', mfg: '2026-09-15', exp: null, qc: 'RELEASED' },
    { id: 'lot-btn-01', num: 'LT-BTN-MOP-01', itm: 'itm-buttons-shell', mfg: '2026-07-20', exp: null, qc: 'RELEASED' },
    { id: 'lot-bag-01', num: 'LT-BAG-SHRT-01', itm: 'itm-poly-garment-bag', mfg: '2026-09-01', exp: null, qc: 'RELEASED' },
    { id: 'lot-fg-tom-41', num: 'LT-FG-TOM-2610-01', itm: 'itm-tomato-paste-800g', mfg: '2026-10-14', exp: '2027-10-14', qc: 'QUARANTINE' },
  ];

  for (const l of lots) {
    db.prepare(
      `INSERT OR IGNORE INTO lots (id, lot_number, item_id, manufacture_date, expiry_date, qc_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '2026-10-14T00:00:00Z')`,
    ).run(l.id, l.num, l.itm, l.mfg, l.exp, l.qc);
  }

  // Stock movements
  invService.recordMovement(ctx, {
    movementType: 'RECEIPT',
    itemId: 'itm-fresh-tomato',
    lotId: 'lot-tom-01',
    locationId: 'loc-cold-room',
    quantityScaled: 25_000_000, // 2,500.0000 KG
    unitCostMinor: 250,
  });
  invService.recordMovement(ctx, {
    movementType: 'RECEIPT',
    itemId: 'itm-fresh-tomato',
    lotId: 'lot-tom-q02',
    locationId: 'loc-cold-room',
    quantityScaled: 8_000_000, // 800.0000 KG (Under Quarantine Inspection)
    unitCostMinor: 250,
  });
  invService.recordMovement(ctx, {
    movementType: 'RECEIPT',
    itemId: 'itm-cotton-fabric-navy',
    lotId: 'lot-fab-01',
    locationId: 'loc-textile-mat',
    quantityScaled: 10_000_000, // 1,000.0000 Meters
    unitCostMinor: 2800,
  });
  invService.recordMovement(ctx, {
    movementType: 'RECEIPT',
    itemId: 'itm-glass-jar-800g',
    lotId: 'lot-jar-01',
    locationId: 'loc-raw-main',
    quantityScaled: 50_000_000, // 5,000 PCS
    unitCostMinor: 120,
  });
  invService.recordMovement(ctx, {
    movementType: 'RECEIPT',
    itemId: 'itm-buttons-shell',
    lotId: 'lot-btn-01',
    locationId: 'loc-textile-mat',
    quantityScaled: 100_000_000, // 10,000 PCS
    unitCostMinor: 35,
  });

  // 6. RECIPES & BOMS
  // Recipe 1: F&B - Tomato Paste 800g (Batch of 1000 Jars)
  const rcpFoodId = 'rcp-tom-paste-800';
  db.prepare(`
    INSERT OR IGNORE INTO recipes (
      id, code, name_ar, name_en, industry_vertical, output_item_id,
      base_quantity_scaled, expected_yield_pct_scaled, overhead_flat_minor, version, is_active, created_at, updated_at
    ) VALUES (
      ?, 'RCP-FB-TOM-01', 'خلطة معجون طماطم مركز 800 جم', 'Premium Tomato Paste Formula 800g', 'FOOD_BEV',
      'itm-tomato-paste-800g', 10000000, 960000, 15000, 1, 1, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z'
    )
  `).run(rcpFoodId);

  // BOM items for Food (Batch of 1000 Jars requires 1,800 KG tomato + 20 KG salt + 1,020 Jars with 2% breakage)
  const foodBom = [
    { itm: 'itm-fresh-tomato', qty: 18000000, scrap: 50000, note: 'Loss during washing and skin peeling' },
    { itm: 'itm-salt-foodgrade', qty: 200000, scrap: 0, note: 'Added during kettle boiling stage' },
    { itm: 'itm-citric-acid', qty: 50000, scrap: 0, note: 'Acidity regulator' },
    { itm: 'itm-glass-jar-800g', qty: 10000000, scrap: 20000, note: 'Glass jar with 2% thermal shock breakage' },
  ];
  for (const b of foodBom) {
    db.prepare(`
      INSERT INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ids.next(), rcpFoodId, b.itm, b.qty, b.scrap, b.note);
  }

  // By-product for Food (Tomato Pomace / Seeds sold to feed mills)
  db.prepare(`
    INSERT INTO recipe_byproducts (id, recipe_id, item_id, yield_quantity_scaled, salvage_value_minor, notes)
    VALUES (?, ?, 'itm-tomato-skin-scrap', 2500000, 15, 'Recovered pomace for animal feed')
  `).run(ids.next(), rcpFoodId);

  // Routings for Food
  const foodRoutings = [
    { wc: 'wc-prep-wash', order: 1, ar: 'غسيل وفرز وتقشير الطماطم', en: 'Washing, Sorting & Peeling', setup: 30, run: 120, head: 2 },
    { wc: 'cook-kettle', order: 2, ar: 'الطهي والتكثيف الحراري تحت التفريغ', en: 'Vacuum Kettle Cooking & Concentration', setup: 45, run: 240, head: 1 },
    { wc: 'wc-fill-pack', order: 3, ar: 'التعقيم والتعبئة والتغطية الآلية', en: 'Hot Filling, Capping & Water Tunnel Cool', setup: 20, run: 90, head: 3 },
  ];
  for (const r of foodRoutings) {
    const wcId = r.wc === 'cook-kettle' ? 'wc-cook-kettle' : r.wc;
    db.prepare(`
      INSERT INTO recipe_routings (id, recipe_id, work_center_id, step_order, name_ar, name_en, setup_time_mins, run_time_mins_scaled, labor_headcount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids.next(), rcpFoodId, wcId, r.order, r.ar, r.en, r.setup, r.run * 10000, r.head);
  }

  // Recipe 2: TEXTILE - Premium Oxford Shirt Navy / L (Batch of 100 Pieces)
  const rcpTexId = 'rcp-tex-shrt-01';
  db.prepare(`
    INSERT OR IGNORE INTO recipes (
      id, code, name_ar, name_en, industry_vertical, output_item_id,
      base_quantity_scaled, expected_yield_pct_scaled, overhead_flat_minor, version, is_active, created_at, updated_at
    ) VALUES (
      ?, 'BOM-TEX-SHRT-L', 'تفصيل وحياكة قميص كحلي مقاس L', 'Oxford Shirt Tailoring BOM - Navy / L', 'TEXTILE',
      'itm-shirt-oxford-l', 1000000, 980000, 8000, 1, 1, '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z'
    )
  `).run(rcpTexId);

  // Textile BOM: 100 shirts requires 160m fabric (1.6m/shirt) + 800 buttons (8/shirt) + thread + polybags
  const texBom = [
    { itm: 'itm-cotton-fabric-navy', qty: 1600000, scrap: 60000, note: 'Pattern marker layout with 6% offcut scrap' },
    { itm: 'itm-buttons-shell', qty: 8000000, scrap: 20000, note: '8 buttons per shirt + 2% sewing drop' },
    { itm: 'itm-thread-poly-navy', qty: 40000, scrap: 0, note: '4 cones thread per 100 garments' },
    { itm: 'itm-poly-garment-bag', qty: 1000000, scrap: 10000, note: '1 bag per finished shirt' },
  ];
  for (const b of texBom) {
    db.prepare(`
      INSERT INTO recipe_items (id, recipe_id, item_id, quantity_scaled, scrap_tolerance_pct_scaled, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ids.next(), rcpTexId, b.itm, b.qty, b.scrap, b.note);
  }

  // Textile Routings
  const texRoutings = [
    { wc: 'wc-tex-cutting', order: 1, ar: 'فرد القماش والقص الآلي بالليزر', en: 'Fabric Spreading & Laser Cutting', setup: 20, run: 60, head: 1 },
    { wc: 'wc-tex-sewing', order: 2, ar: 'تجميع الياقة والأكمام وخياطة الأزرار', en: 'Collar, Sleeves & Button Attachment', setup: 15, run: 300, head: 5 },
    { wc: 'wc-tex-press', order: 3, ar: 'الكي بالبخار والفحص النهائي والتكييس', en: 'Steam Pressing, Quality Inspection & Polybagging', setup: 10, run: 80, head: 2 },
  ];
  for (const r of texRoutings) {
    db.prepare(`
      INSERT INTO recipe_routings (id, recipe_id, work_center_id, step_order, name_ar, name_en, setup_time_mins, run_time_mins_scaled, labor_headcount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids.next(), rcpTexId, r.wc, r.order, r.ar, r.en, r.setup, r.run * 10000, r.head);
  }

  // 7. Initial Work Orders linking to recipes
  const wo1 = woService.createWorkOrder(ctx, {
    orderNumber: 'WO-2026-00041',
    itemId: 'itm-tomato-paste-800g',
    plannedQuantityScaled: 10_000_000, // 1,000 PCS
    dueDate: '2026-10-18T09:00:00Z',
    notes: 'تشغيل دفعة معجون طماطم مركز وفق الوصفة المعيارية RCP-FB-TOM-01',
  });
  db.prepare('UPDATE work_orders SET recipe_id = ? WHERE id = ?').run(rcpFoodId, wo1.id);
  woService.releaseWorkOrder(ctx, wo1.id);
  woService.startWorkOrder(ctx, wo1.id);

  const wo2 = woService.createWorkOrder(ctx, {
    orderNumber: 'WO-2026-00085',
    itemId: 'itm-shirt-oxford-l',
    plannedQuantityScaled: 2_500_000, // 250 PCS
    dueDate: '2026-10-22T09:00:00Z',
    notes: 'طلبية تصدير - قمصان أكسفورد قطن كحلي مقاس L (تشغيل صالة الحياكة)',
  });
  db.prepare('UPDATE work_orders SET recipe_id = ? WHERE id = ?').run(rcpTexId, wo2.id);
  woService.releaseWorkOrder(ctx, wo2.id);

  return { seeded: true };
}
