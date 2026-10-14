/**
 * Enterprise ERP Schema Definitions & TypeScript Interfaces
 * Matches SAP MM (Materials Management) & SAP PP (Production Planning) paradigms.
 */

export type WorkOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type IndustryVertical = 'FOOD_BEV' | 'TEXTILE' | 'GENERAL';
export type ItemType = 'RAW' | 'PACKAGING' | 'INTERMEDIATE' | 'FINISHED';
export type LocationType = 'WAREHOUSE' | 'COLD_ROOM' | 'PRODUCTION' | 'SCRAP';
export type QcStatus = 'QUARANTINE' | 'RELEASED' | 'REJECTED';
export type MovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'PRODUCTION_CONSUME'
  | 'PRODUCTION_YIELD'
  | 'SCRAP';

/**
 * SAP MM: Item Master (Material Master - MARA / MARC)
 */
export interface ItemDto {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  type: ItemType;
  uom_code: string;
  cost_minor: number; // Moving Average Cost in minor units (Halalas)
  selling_price_minor?: number; // Selling price in minor units (Halalas)
  reorder_point_scaled: number; // Fixed point 10,000 scale (e.g. 10000 = 1.0000)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateItemDto {
  code: string;
  name_ar: string;
  name_en: string;
  type: ItemType;
  uom_code: string;
  cost_minor?: number;
  selling_price_minor?: number;
  reorder_point_scaled?: number;
  is_active?: boolean;
}

export interface UpdateItemDto {
  code?: string;
  name_ar?: string;
  name_en?: string;
  type?: ItemType;
  uom_code?: string;
  cost_minor?: number;
  selling_price_minor?: number;
  reorder_point_scaled?: number;
  is_active?: boolean;
}

/**
 * SAP PP: Work Center (Work Center / Resource - CRHD)
 */
export interface WorkCenterDto {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  labor_rate_minor: number; // Halalas per hour
  overhead_rate_minor: number; // Halalas per hour
  capacity_per_hour_scaled: number; // Capacity per hour in standard scale (10,000 = 1.0000)
  is_active: boolean;
  created_at: string;
}

export interface CreateWorkCenterDto {
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  labor_rate_minor: number;
  overhead_rate_minor: number;
  capacity_per_hour_scaled?: number;
  is_active?: boolean;
}

export interface UpdateWorkCenterDto {
  code?: string;
  name_ar?: string;
  name_en?: string;
  industry_vertical?: IndustryVertical;
  labor_rate_minor?: number;
  overhead_rate_minor?: number;
  capacity_per_hour_scaled?: number;
  is_active?: boolean;
}

/**
 * SAP PP: Bill of Materials & Formulas (STKO / STPO) & Routings (PLKO / PLPO)
 */
export interface RecipeItemDto {
  id: string;
  item_id: string;
  item_code: string;
  item_name_ar: string;
  item_name_en: string;
  uom_code: string;
  unit_cost_minor: number;
  quantity_scaled: number;
  scrap_tolerance_pct_scaled: number; // Fixed point 10,000 = 1.00% (e.g. 50,000 = 5.00%)
  notes?: string;
}

export interface RecipeByproductDto {
  id: string;
  item_id: string;
  item_code: string;
  item_name_ar: string;
  item_name_en: string;
  uom_code: string;
  yield_quantity_scaled: number;
  salvage_value_minor: number;
  notes?: string;
}

export interface RecipeRoutingDto {
  id: string;
  work_center_code: string;
  work_center_name_ar: string;
  work_center_name_en: string;
  step_order: number;
  name_ar: string;
  name_en: string;
  setup_time_mins: number;
  run_time_mins_scaled: number; // Run time per batch unit scaled (10,000 = 1 minute)
  labor_headcount: number;
  labor_rate_minor: number;
  overhead_rate_minor: number;
}

export interface RecipeDto {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  output_item_id: string;
  output_item_code: string;
  output_item_name_ar: string;
  output_item_name_en: string;
  output_uom: string;
  base_quantity_scaled: number;
  expected_yield_pct_scaled: number; // e.g. 960,000 = 96.00%
  overhead_flat_minor: number;
  version: number;
  is_active: boolean;
  items: RecipeItemDto[];
  byproducts: RecipeByproductDto[];
  routings: RecipeRoutingDto[];
  created_at: string;
  updated_at: string;
}

export interface CreateRecipeDto {
  code: string;
  name_ar: string;
  name_en: string;
  industry_vertical: IndustryVertical;
  output_item_id: string;
  base_quantity_scaled: number;
  expected_yield_pct_scaled?: number;
  overhead_flat_minor?: number;
  items?: Array<{
    item_id: string;
    quantity_scaled: number;
    scrap_tolerance_pct_scaled?: number;
    notes?: string;
  }>;
  byproducts?: Array<{
    item_id: string;
    yield_quantity_scaled: number;
    salvage_value_minor?: number;
    notes?: string;
  }>;
  routings?: Array<{
    work_center_code: string;
    step_order: number;
    name_ar: string;
    name_en: string;
    setup_time_mins: number;
    run_time_mins_scaled: number;
    labor_headcount: number;
  }>;
}

export interface UpdateRecipeDto {
  code?: string;
  name_ar?: string;
  name_en?: string;
  industry_vertical?: IndustryVertical;
  output_item_id?: string;
  base_quantity_scaled?: number;
  expected_yield_pct_scaled?: number;
  overhead_flat_minor?: number;
  is_active?: boolean;
  items?: Array<{
    item_id: string;
    quantity_scaled: number;
    scrap_tolerance_pct_scaled?: number;
    notes?: string;
  }>;
  byproducts?: Array<{
    item_id: string;
    yield_quantity_scaled: number;
    salvage_value_minor?: number;
    notes?: string;
  }>;
  routings?: Array<{
    work_center_code: string;
    step_order: number;
    name_ar: string;
    name_en: string;
    setup_time_mins: number;
    run_time_mins_scaled: number;
    labor_headcount: number;
  }>;
}

/**
 * Standard Cost Breakdown calculation
 */
export interface CostBreakdownDto {
  recipeId: string;
  baseQuantityScaled: number;
  totalDirectMaterialMinor: number;
  totalDirectLaborMinor: number;
  totalMachineOverheadMinor: number;
  byproductCreditMinor: number;
  totalBatchCostMinor: number;
  unitCostMinor: number;
  expectedYieldQtyScaled: number;
  itemsCost: Array<{
    itemId: string;
    itemCode: string;
    nameAr: string;
    nameEn: string;
    quantityScaled: number;
    unitCostMinor: number;
    lineCostMinor: number;
    scrapPct: number;
  }>;
  routingsCost: Array<{
    stepOrder: number;
    stepNameEn: string;
    workCenterCode: string;
    laborCostMinor: number;
    machineCostMinor: number;
    totalStepCostMinor: number;
  }>;
}

/**
 * SAP PP: Production / Work Order (AFKO / AFPO)
 */
export interface WorkOrderRow {
  id: string;
  order_number: string;
  item_id: string;
  item_name?: string;
  target_lot_id: string | null;
  lot_number?: string;
  planned_quantity_scaled: number;
  yield_quantity_scaled: number;
  scrap_quantity_scaled: number;
  status: WorkOrderStatus;
  qc_status: string;
  due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderConsumptionRecord {
  id: string;
  work_order_id: string;
  item_id: string;
  lot_id: string;
  location_id: string;
  quantity_scaled: number;
  unit_cost_minor: number;
  recorded_at: string;
}

export interface CreateWorkOrderDto {
  orderNumber: string;
  itemId: string;
  plannedQuantityScaled: number;
  dueDate: string;
  notes?: string;
  targetLotId?: string | null;
}

export interface CompleteWorkOrderDto {
  yieldQuantityScaled: number;
  scrapQuantityScaled: number;
  targetLotId: string;
  targetLocationId: string;
  unitCostMinor?: number;
}

export interface AddConsumptionDto {
  workOrderId: string;
  itemId: string;
  lotId: string;
  locationId: string;
  quantityScaled: number;
  unitCostMinor?: number;
}

/**
 * SAP MM: Batch & Inventory Ledger (MCH1 / MARD / MSEG)
 */
export interface LotDto {
  id: string;
  lot_number: string;
  item_id: string;
  item_code?: string;
  item_name_ar?: string;
  item_name_en?: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  qc_status: QcStatus;
  created_at: string;
}

export interface StockOnHandDto {
  itemId: string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn: string;
  uomCode: string;
  totalQuantityScaled: number;
  byLot: Array<{
    lotId: string;
    lotNumber: string;
    qcStatus: QcStatus;
    locationId: string;
    quantityScaled: number;
  }>;
}

export interface InventoryMovementDto {
  id: string;
  movement_type: MovementType;
  item_id: string;
  lot_id: string;
  location_id: string;
  quantity_scaled: number; // Signed delta in scale 10,000
  unit_cost_minor: number;
  reference_type?: string | null;
  reference_id?: string | null;
  actor_id: string;
  created_at: string;
}

export interface StockBalanceRow {
  itemId: string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn: string;
  itemType: string;
  uomCode: string;
  unitCostMinor: number;
  lotId: string;
  lotNumber: string;
  expiryDate: string | null;
  qcStatus: string;
  locationId: string;
  locationCode: string;
  locationNameAr: string;
  locationNameEn: string;
  locationType: string;
  quantityScaled: number;
  totalValueMinor: number;
}

export interface GoodsReceiptDto {
  itemId: string;
  lotNumber: string;
  locationId: string;
  quantityScaled: number;
  unitCostMinor: number;
  expiryDate?: string | null;
  manufactureDate?: string | null;
  qcStatus?: 'QUARANTINE' | 'RELEASED';
}

export interface DashboardMetricsDto {
  totalValuationMinor: number;
  activeWorkOrdersWipMinor: number;
  activeWorkOrdersCount: number;
  monthlyProductionYieldPct: number;
  costVarianceMinor: number;
  varianceBreakdown: Array<{
    category: string;
    categoryAr: string;
    categoryEn: string;
    standardMinor: number;
    actualMinor: number;
    varianceMinor: number;
  }>;
}

export interface RecordMovementDto {
  movementType: MovementType;
  itemId: string;
  lotId: string;
  locationId: string;
  quantityScaled: number;
  unitCostMinor?: number;
  referenceType?: string;
  referenceId?: string;
  actorId?: string;
}

/**
 * Top-Level LabApiClient API interface
 */
export interface LabApiClient {
  items: {
    list(filter?: { type?: ItemType; isActive?: boolean }): Promise<ItemDto[]>;
    get(id: string): Promise<ItemDto | null>;
    create(dto: CreateItemDto): Promise<ItemDto>;
    update(id: string, dto: UpdateItemDto): Promise<ItemDto>;
    delete(id: string): Promise<{ deleted: boolean }>;
  };
  workCenters: {
    list(industry?: IndustryVertical): Promise<WorkCenterDto[]>;
    get(id: string): Promise<WorkCenterDto | null>;
    create(dto: CreateWorkCenterDto): Promise<WorkCenterDto>;
    update(id: string, dto: UpdateWorkCenterDto): Promise<WorkCenterDto>;
    delete(id: string): Promise<{ deleted: boolean }>;
  };
  recipes: {
    list(industry?: IndustryVertical): Promise<RecipeDto[]>;
    get(id: string): Promise<RecipeDto | null>;
    create(dto: CreateRecipeDto): Promise<RecipeDto>;
    update(id: string, dto: UpdateRecipeDto): Promise<RecipeDto>;
    delete(id: string): Promise<{ deleted: boolean }>;
    calculateCost(id: string, batchQtyScaled?: number): Promise<CostBreakdownDto>;
  };
  workOrders: {
    list(status?: WorkOrderStatus): Promise<WorkOrderRow[]>;
    get(id: string): Promise<WorkOrderRow | null>;
    create(dto: CreateWorkOrderDto): Promise<WorkOrderRow>;
    release(id: string): Promise<WorkOrderRow>;
    start(id: string): Promise<WorkOrderRow>;
    complete(id: string, params: CompleteWorkOrderDto): Promise<WorkOrderRow>;
    cancel(id: string, reason?: string): Promise<WorkOrderRow>;
    addConsumption(dto: AddConsumptionDto): Promise<WorkOrderConsumptionRecord>;
  };
  inventory: {
    listLots(itemId?: string): Promise<LotDto[]>;
    getStockOnHand(itemId?: string): Promise<StockOnHandDto[]>;
    listStockBalances(): Promise<StockBalanceRow[]>;
    getBalance(itemId: string, lotId?: string, locationId?: string): Promise<string>;
    recordMovement(dto: RecordMovementDto): Promise<InventoryMovementDto>;
    receiveGoods(dto: GoodsReceiptDto): Promise<{ lotId: string; movementId: string }>;
    updateLotQc(lotId: string, qcStatus: QcStatus, notes?: string): Promise<LotDto>;
    getDashboardMetrics(): Promise<DashboardMetricsDto>;
  };
  system: {
    exportData(): LabPersistentData;
    importData(data: LabPersistentData): void;
    resetToEmpty(): void;
    seedDefaultData(): void;
  };
}

/**
 * Full persistent schema stored in browser localStorage
 */
export interface LabPersistentData {
  schemaVersion: number;
  items: ItemDto[];
  workCenters: WorkCenterDto[];
  recipes: RecipeDto[];
  workOrders: WorkOrderRow[];
  workOrderConsumptions: WorkOrderConsumptionRecord[];
  lots: LotDto[];
  movements: InventoryMovementDto[];
}

export const STORAGE_KEY_V1 = 'the-lab.data.v1';

// Seeded sample data for factory initialization
export const SEED_DATA: LabPersistentData = {
  schemaVersion: 1,
  items: [
    {
      id: 'itm-fresh-tomato',
      code: 'RAW-TOM-01',
      name_ar: 'طماطم طازجة صنف أ',
      name_en: 'Fresh Tomatoes Grade A',
      type: 'RAW',
      uom_code: 'KG',
      cost_minor: 250,
      reorder_point_scaled: 5000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-salt-foodgrade',
      code: 'RAW-SLT-01',
      name_ar: 'ملح طعام نقي',
      name_en: 'Food Grade Salt',
      type: 'RAW',
      uom_code: 'KG',
      cost_minor: 80,
      reorder_point_scaled: 1000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-citric-acid',
      code: 'RAW-CIT-01',
      name_ar: 'حمض الستريك الغذائي',
      name_en: 'Food Grade Citric Acid',
      type: 'RAW',
      uom_code: 'KG',
      cost_minor: 600,
      reorder_point_scaled: 500000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-glass-jar-800g',
      code: 'PKG-JAR-800',
      name_ar: 'مرطبان زجاجي 800 جم مع غطاء',
      name_en: 'Glass Jar 800g with Lid',
      type: 'PACKAGING',
      uom_code: 'PCS',
      cost_minor: 120,
      reorder_point_scaled: 20000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-tomato-skin-scrap',
      code: 'BYP-TOM-SKIN',
      name_ar: 'تفل وقشور الطماطم (علف)',
      name_en: 'Tomato Pomace (By-product)',
      type: 'INTERMEDIATE',
      uom_code: 'KG',
      cost_minor: 20,
      reorder_point_scaled: 0,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-tomato-paste-800g',
      code: 'FG-TOM-800',
      name_ar: 'معجون طماطم فاخر 800 جم',
      name_en: 'Premium Tomato Paste 800g',
      type: 'FINISHED',
      uom_code: 'PCS',
      cost_minor: 1250,
      reorder_point_scaled: 10000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-cotton-fabric-navy',
      code: 'RAW-FAB-NVY',
      name_ar: 'قماش قطن مصري 100% - كحلي',
      name_en: 'Egyptian Cotton Fabric - Navy',
      type: 'RAW',
      uom_code: 'M',
      cost_minor: 2800,
      reorder_point_scaled: 3000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-thread-poly-navy',
      code: 'RAW-THRD-NVY',
      name_ar: 'بكرة خيط بوليستر صناعي كحلي',
      name_en: 'Industrial Polyester Thread Navy',
      type: 'RAW',
      uom_code: 'PCS',
      cost_minor: 450,
      reorder_point_scaled: 2000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-buttons-shell',
      code: 'TRM-BTN-MOP',
      name_ar: 'أزرار صدفية طبيعية 12 مم',
      name_en: 'Mother of Pearl Buttons 12mm',
      type: 'RAW',
      uom_code: 'PCS',
      cost_minor: 35,
      reorder_point_scaled: 50000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-poly-garment-bag',
      code: 'PKG-BAG-01',
      name_ar: 'كيس تغليف قمصان شفاف',
      name_en: 'Clear Shirt Polybag',
      type: 'PACKAGING',
      uom_code: 'PCS',
      cost_minor: 40,
      reorder_point_scaled: 10000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'itm-shirt-oxford-l',
      code: 'FG-SHRT-NVY-L',
      name_ar: 'قميص أكسفورد قطن كحلي مقاس L',
      name_en: 'Oxford Cotton Shirt - Navy / L',
      type: 'FINISHED',
      uom_code: 'PCS',
      cost_minor: 8900,
      reorder_point_scaled: 1500000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    },
  ],
  workCenters: [
    {
      id: 'wc-prep-wash',
      code: 'WC-FOOD-PREP',
      name_ar: 'محطة الفرز والغسيل',
      name_en: 'Washing & Sorting Station',
      industry_vertical: 'FOOD_BEV',
      labor_rate_minor: 3500,
      overhead_rate_minor: 1500,
      capacity_per_hour_scaled: 5000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'wc-cook-kettle',
      code: 'WC-FOOD-COOK',
      name_ar: 'غلايات التكثيف والطهي',
      name_en: 'Industrial Cooking Kettles',
      industry_vertical: 'FOOD_BEV',
      labor_rate_minor: 4000,
      overhead_rate_minor: 5500,
      capacity_per_hour_scaled: 2000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'wc-fill-pack',
      code: 'WC-FOOD-PACK',
      name_ar: 'خط التعبئة والتعقيم',
      name_en: 'Sterile Filling & Capping Line',
      industry_vertical: 'FOOD_BEV',
      labor_rate_minor: 3000,
      overhead_rate_minor: 4500,
      capacity_per_hour_scaled: 3000000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'wc-tex-cutting',
      code: 'WC-TEX-CUT',
      name_ar: 'طاولة القص بالليزر الآلية',
      name_en: 'Automated Laser Cutting Table',
      industry_vertical: 'TEXTILE',
      labor_rate_minor: 4500,
      overhead_rate_minor: 3000,
      capacity_per_hour_scaled: 1500000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'wc-tex-sewing',
      code: 'WC-TEX-SEW',
      name_ar: 'خط الحياكة والتجميع',
      name_en: 'Precision Sewing Assembly Line',
      industry_vertical: 'TEXTILE',
      labor_rate_minor: 3800,
      overhead_rate_minor: 1200,
      capacity_per_hour_scaled: 800000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'wc-tex-press',
      code: 'WC-TEX-FINISH',
      name_ar: 'محطة الكي والفحص والتغليف',
      name_en: 'Pressing, QC & Packing Station',
      industry_vertical: 'TEXTILE',
      labor_rate_minor: 3000,
      overhead_rate_minor: 1000,
      capacity_per_hour_scaled: 1200000,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
    },
  ],
  recipes: [
    {
      id: 'rcp-tom-paste-800',
      code: 'RCP-FB-TOM-01',
      name_ar: 'خلطة معجون طماطم مركز 800 جم',
      name_en: 'Premium Tomato Paste Formula 800g',
      industry_vertical: 'FOOD_BEV',
      output_item_id: 'itm-tomato-paste-800g',
      output_item_code: 'FG-TOM-800',
      output_item_name_ar: 'معجون طماطم فاخر 800 جم',
      output_item_name_en: 'Premium Tomato Paste 800g',
      output_uom: 'PCS',
      base_quantity_scaled: 10000000,
      expected_yield_pct_scaled: 960000,
      overhead_flat_minor: 15000,
      version: 1,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      items: [
        {
          id: 'ri-1',
          item_id: 'itm-fresh-tomato',
          item_code: 'RAW-TOM-01',
          item_name_ar: 'طماطم طازجة صنف أ',
          item_name_en: 'Fresh Tomatoes Grade A',
          uom_code: 'KG',
          unit_cost_minor: 250,
          quantity_scaled: 18000000,
          scrap_tolerance_pct_scaled: 50000,
          notes: 'فقد طبيعي أثناء الغسيل وإزالة القشور',
        },
        {
          id: 'ri-2',
          item_id: 'itm-salt-foodgrade',
          item_code: 'RAW-SLT-01',
          item_name_ar: 'ملح طعام نقي',
          item_name_en: 'Food Grade Salt',
          uom_code: 'KG',
          unit_cost_minor: 80,
          quantity_scaled: 200000,
          scrap_tolerance_pct_scaled: 0,
        },
        {
          id: 'ri-3',
          item_id: 'itm-citric-acid',
          item_code: 'RAW-CIT-01',
          item_name_ar: 'حمض الستريك الغذائي',
          item_name_en: 'Citric Acid Grade A',
          uom_code: 'KG',
          unit_cost_minor: 600,
          quantity_scaled: 50000,
          scrap_tolerance_pct_scaled: 0,
        },
        {
          id: 'ri-4',
          item_id: 'itm-glass-jar-800g',
          item_code: 'PKG-JAR-800',
          item_name_ar: 'مرطبان زجاجي 800 جم مع غطاء',
          item_name_en: 'Glass Jar 800g with Lid',
          uom_code: 'PCS',
          unit_cost_minor: 120,
          quantity_scaled: 10000000,
          scrap_tolerance_pct_scaled: 20000,
          notes: 'نسبة كسر مسموحة 2% تحت الصدمة الحرارية',
        },
      ],
      byproducts: [
        {
          id: 'rb-1',
          item_id: 'itm-tomato-skin-scrap',
          item_code: 'BYP-TOM-SKIN',
          item_name_ar: 'تفل وقشور الطماطم (علف)',
          item_name_en: 'Tomato Pomace (By-product)',
          uom_code: 'KG',
          yield_quantity_scaled: 2500000,
          salvage_value_minor: 15,
          notes: 'Recovered pomace for animal feed',
        },
      ],
      routings: [
        {
          id: 'rr-1',
          work_center_code: 'WC-FOOD-PREP',
          work_center_name_ar: 'محطة الفرز والغسيل',
          work_center_name_en: 'Washing & Sorting Station',
          step_order: 1,
          name_ar: 'غسيل وفرز وتقشير الطماطم',
          name_en: 'Washing, Sorting & Peeling',
          setup_time_mins: 30,
          run_time_mins_scaled: 1200000,
          labor_headcount: 2,
          labor_rate_minor: 3500,
          overhead_rate_minor: 1500,
        },
        {
          id: 'rr-2',
          work_center_code: 'WC-FOOD-COOK',
          work_center_name_ar: 'غلايات التكثيف والطهي',
          work_center_name_en: 'Industrial Cooking Kettles',
          step_order: 2,
          name_ar: 'الطهي والتكثيف الحراري تحت التفريغ',
          name_en: 'Vacuum Kettle Cooking & Concentration',
          setup_time_mins: 45,
          run_time_mins_scaled: 2400000,
          labor_headcount: 1,
          labor_rate_minor: 4000,
          overhead_rate_minor: 5500,
        },
        {
          id: 'rr-3',
          work_center_code: 'WC-FOOD-PACK',
          work_center_name_ar: 'خط التعبئة والتعقيم',
          work_center_name_en: 'Sterile Filling & Capping Line',
          step_order: 3,
          name_ar: 'التعقيم والتعبئة والتغطية الآلية',
          name_en: 'Hot Filling, Capping & Water Tunnel Cool',
          setup_time_mins: 20,
          run_time_mins_scaled: 900000,
          labor_headcount: 3,
          labor_rate_minor: 3000,
          overhead_rate_minor: 4500,
        },
      ],
    },
    {
      id: 'rcp-tex-shrt-01',
      code: 'BOM-TEX-SHRT-L',
      name_ar: 'تفصيل وحياكة قميص كحلي مقاس L',
      name_en: 'Oxford Shirt Tailoring BOM - Navy / L',
      industry_vertical: 'TEXTILE',
      output_item_id: 'itm-shirt-oxford-l',
      output_item_code: 'FG-SHRT-NVY-L',
      output_item_name_ar: 'قميص أكسفورد قطن كحلي مقاس L',
      output_item_name_en: 'Oxford Cotton Shirt - Navy / L',
      output_uom: 'PCS',
      base_quantity_scaled: 1000000,
      expected_yield_pct_scaled: 980000,
      overhead_flat_minor: 8000,
      version: 1,
      is_active: true,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      items: [
        {
          id: 'ti-1',
          item_id: 'itm-cotton-fabric-navy',
          item_code: 'RAW-FAB-NVY',
          item_name_ar: 'قماش قطن مصري 100% - كحلي',
          item_name_en: 'Egyptian Cotton Fabric - Navy',
          uom_code: 'M',
          unit_cost_minor: 2800,
          quantity_scaled: 1600000,
          scrap_tolerance_pct_scaled: 60000,
          notes: 'مخطط القص الآلي بهدر تعشيق 6%',
        },
        {
          id: 'ti-2',
          item_id: 'itm-buttons-shell',
          item_code: 'TRM-BTN-MOP',
          item_name_ar: 'أزرار صدفية طبيعية 12 مم',
          item_name_en: 'Mother of Pearl Buttons 12mm',
          uom_code: 'PCS',
          unit_cost_minor: 35,
          quantity_scaled: 8000000,
          scrap_tolerance_pct_scaled: 20000,
        },
        {
          id: 'ti-3',
          item_id: 'itm-thread-poly-navy',
          item_code: 'RAW-THRD-NVY',
          item_name_ar: 'بكرة خيط بوليستر صناعي كحلي',
          item_name_en: 'Industrial Polyester Thread Navy',
          uom_code: 'PCS',
          unit_cost_minor: 450,
          quantity_scaled: 40000,
          scrap_tolerance_pct_scaled: 0,
        },
        {
          id: 'ti-4',
          item_id: 'itm-poly-garment-bag',
          item_code: 'PKG-BAG-01',
          item_name_ar: 'كيس تغليف قمصان شفاف',
          item_name_en: 'Clear Shirt Polybag',
          uom_code: 'PCS',
          unit_cost_minor: 40,
          quantity_scaled: 1000000,
          scrap_tolerance_pct_scaled: 10000,
        },
      ],
      byproducts: [],
      routings: [
        {
          id: 'tr-1',
          work_center_code: 'WC-TEX-CUT',
          work_center_name_ar: 'طاولة القص بالليزر الآلية',
          work_center_name_en: 'Automated Laser Cutting Table',
          step_order: 1,
          name_ar: 'فرد القماش والقص الآلي بالليزر',
          name_en: 'Fabric Spreading & Laser Cutting',
          setup_time_mins: 20,
          run_time_mins_scaled: 600000,
          labor_headcount: 1,
          labor_rate_minor: 4500,
          overhead_rate_minor: 3000,
        },
        {
          id: 'tr-2',
          work_center_code: 'WC-TEX-SEW',
          work_center_name_ar: 'خط الحياكة والتجميع',
          work_center_name_en: 'Precision Sewing Assembly Line',
          step_order: 2,
          name_ar: 'تجميع الياقة والأكمام وخياطة الأزرار',
          name_en: 'Collar, Sleeves & Button Attachment',
          setup_time_mins: 15,
          run_time_mins_scaled: 3000000,
          labor_headcount: 5,
          labor_rate_minor: 3800,
          overhead_rate_minor: 1200,
        },
        {
          id: 'tr-3',
          work_center_code: 'WC-TEX-FINISH',
          work_center_name_ar: 'محطة الكي والفحص والتغليف',
          work_center_name_en: 'Pressing, QC & Packing Station',
          step_order: 3,
          name_ar: 'الكي بالبخار والفحص النهائي والتكييس',
          name_en: 'Steam Pressing, Quality Inspection & Polybagging',
          setup_time_mins: 10,
          run_time_mins_scaled: 800000,
          labor_headcount: 2,
          labor_rate_minor: 3000,
          overhead_rate_minor: 1000,
        },
      ],
    },
  ],
  workOrders: [
    {
      id: 'wo-01',
      order_number: 'WO-2026-00041',
      item_id: 'itm-tomato-paste-800g',
      item_name: 'معجون طماطم فاخر 800 جم (RCP-FB-TOM-01)',
      target_lot_id: 'lot-fg-tom-41',
      lot_number: 'LT-260412-A',
      planned_quantity_scaled: 10000000,
      yield_quantity_scaled: 0,
      scrap_quantity_scaled: 0,
      status: 'IN_PROGRESS',
      qc_status: 'QUARANTINE',
      due_date: '2026-10-18T09:00:00Z',
      notes: 'تشغيل دفعة معجون طماطم مركز وفق الوصفة المعيارية',
      created_at: '2026-10-13T10:00:00Z',
      updated_at: '2026-10-14T08:00:00Z',
    },
    {
      id: 'wo-02',
      order_number: 'WO-2026-00085',
      item_id: 'itm-shirt-oxford-l',
      item_name: 'قميص أكسفورد قطن كحلي مقاس L (BOM-TEX-SHRT-L)',
      target_lot_id: null,
      lot_number: 'LT-TEX-2610-01',
      planned_quantity_scaled: 2500000,
      yield_quantity_scaled: 0,
      scrap_quantity_scaled: 0,
      status: 'RELEASED',
      qc_status: 'QUARANTINE',
      due_date: '2026-10-22T09:00:00Z',
      notes: 'طلبية تصدير - قمصان أكسفورد قطن كحلي مقاس L',
      created_at: '2026-10-14T07:00:00Z',
      updated_at: '2026-10-14T07:00:00Z',
    },
  ],
  workOrderConsumptions: [],
  lots: [
    {
      id: 'lot-tom-01',
      lot_number: 'LT-TOM-2610-01',
      item_id: 'itm-fresh-tomato',
      item_code: 'RAW-TOM-01',
      item_name_ar: 'طماطم طازجة صنف أ',
      item_name_en: 'Fresh Tomatoes Grade A',
      manufacture_date: '2026-10-10',
      expiry_date: '2026-11-10',
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-tom-q02',
      lot_number: 'LT-TOM-2610-Q02',
      item_id: 'itm-fresh-tomato',
      item_code: 'RAW-TOM-01',
      item_name_ar: 'طماطم طازجة صنف أ',
      item_name_en: 'Fresh Tomatoes Grade A',
      manufacture_date: '2026-10-13',
      expiry_date: '2026-11-13',
      qc_status: 'QUARANTINE',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-slt-01',
      lot_number: 'LT-SLT-2610-01',
      item_id: 'itm-salt-foodgrade',
      item_code: 'RAW-SLT-01',
      item_name_ar: 'ملح طعام نقي',
      item_name_en: 'Food Grade Salt',
      manufacture_date: '2026-09-01',
      expiry_date: '2028-09-01',
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-cit-01',
      lot_number: 'LT-CIT-2610-01',
      item_id: 'itm-citric-acid',
      item_code: 'RAW-CIT-01',
      item_name_ar: 'حمض الستريك الغذائي',
      item_name_en: 'Food Grade Citric Acid',
      manufacture_date: '2026-08-01',
      expiry_date: '2028-08-01',
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-jar-01',
      lot_number: 'LT-JAR-2610-01',
      item_id: 'itm-glass-jar-800g',
      item_code: 'PKG-JAR-800',
      item_name_ar: 'مرطبان زجاجي 800 جم مع غطاء',
      item_name_en: 'Glass Jar 800g with Lid',
      manufacture_date: '2026-08-15',
      expiry_date: null,
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-fab-01',
      lot_number: 'LT-FAB-NVY-01',
      item_id: 'itm-cotton-fabric-navy',
      item_code: 'RAW-FAB-NVY',
      item_name_ar: 'قماش قطن مصري 100% - كحلي',
      item_name_en: 'Egyptian Cotton Fabric - Navy',
      manufacture_date: '2026-09-15',
      expiry_date: null,
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-btn-01',
      lot_number: 'LT-BTN-MOP-01',
      item_id: 'itm-buttons-shell',
      item_code: 'TRM-BTN-MOP',
      item_name_ar: 'أزرار صدفية طبيعية 12 مم',
      item_name_en: 'Mother of Pearl Buttons 12mm',
      manufacture_date: '2026-07-20',
      expiry_date: null,
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-bag-01',
      lot_number: 'LT-BAG-SHRT-01',
      item_id: 'itm-poly-garment-bag',
      item_code: 'PKG-BAG-01',
      item_name_ar: 'كيس تغليف قمصان شفاف',
      item_name_en: 'Clear Shirt Polybag',
      manufacture_date: '2026-09-01',
      expiry_date: null,
      qc_status: 'RELEASED',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'lot-fg-tom-41',
      lot_number: 'LT-260412-A',
      item_id: 'itm-tomato-paste-800g',
      item_code: 'FG-TOM-800',
      item_name_ar: 'معجون طماطم فاخر 800 جم',
      item_name_en: 'Premium Tomato Paste 800g',
      manufacture_date: '2026-10-14',
      expiry_date: '2027-10-14',
      qc_status: 'QUARANTINE',
      created_at: '2026-10-14T00:00:00Z',
    },
  ],
  movements: [
    {
      id: 'mov-01',
      movement_type: 'RECEIPT',
      item_id: 'itm-fresh-tomato',
      lot_id: 'lot-tom-01',
      location_id: 'loc-cold-room',
      quantity_scaled: 25000000, // 2,500.0000 KG
      unit_cost_minor: 250,
      actor_id: 'usr-system-seed',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'mov-02',
      movement_type: 'RECEIPT',
      item_id: 'itm-cotton-fabric-navy',
      lot_id: 'lot-fab-01',
      location_id: 'loc-textile-mat',
      quantity_scaled: 10000000, // 1,000.0000 Meters
      unit_cost_minor: 2800,
      actor_id: 'usr-system-seed',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'mov-03',
      movement_type: 'RECEIPT',
      item_id: 'itm-glass-jar-800g',
      lot_id: 'lot-jar-01',
      location_id: 'loc-raw-main',
      quantity_scaled: 50000000, // 5,000 PCS
      unit_cost_minor: 120,
      actor_id: 'usr-system-seed',
      created_at: '2026-10-14T00:00:00Z',
    },
    {
      id: 'mov-04',
      movement_type: 'RECEIPT',
      item_id: 'itm-buttons-shell',
      lot_id: 'lot-btn-01',
      location_id: 'loc-textile-mat',
      quantity_scaled: 100000000, // 10,000 PCS
      unit_cost_minor: 35,
      actor_id: 'usr-system-seed',
      created_at: '2026-10-14T00:00:00Z',
    },
  ],
};

export const EMPTY_SYSTEM_DATA: LabPersistentData = {
  schemaVersion: 1,
  items: [],
  workCenters: [],
  recipes: [],
  workOrders: [],
  workOrderConsumptions: [],
  lots: [],
  movements: [],
};

/**
 * Standard Costing engine for recipes and batch simulations
 */
export function computeRecipeCost(recipe: RecipeDto, batchQtyScaled?: number): CostBreakdownDto {
  const baseQty = recipe.base_quantity_scaled;
  const batchQty = batchQtyScaled ?? baseQty;
  const scale = batchQty / (baseQty || 10000);

  let totalDirectMaterialMinor = 0;
  const itemsCost: CostBreakdownDto['itemsCost'] = [];

  for (const it of recipe.items) {
    const scaledQty = Math.round(it.quantity_scaled * scale);
    const scrapFactor = 1 + (it.scrap_tolerance_pct_scaled || 0) / 1000000;
    const requiredQty = Math.round(scaledQty * scrapFactor);
    const lineCost = Math.round((requiredQty * it.unit_cost_minor) / 10000);
    totalDirectMaterialMinor += lineCost;

    itemsCost.push({
      itemId: it.item_id,
      itemCode: it.item_code,
      nameAr: it.item_name_ar,
      nameEn: it.item_name_en,
      quantityScaled: requiredQty,
      unitCostMinor: it.unit_cost_minor,
      lineCostMinor: lineCost,
      scrapPct: (it.scrap_tolerance_pct_scaled || 0) / 10000,
    });
  }

  let byproductCreditMinor = 0;
  for (const bp of recipe.byproducts) {
    const bpQty = Math.round(bp.yield_quantity_scaled * scale);
    const credit = Math.round((bpQty * bp.salvage_value_minor) / 10000);
    byproductCreditMinor += credit;
  }

  let totalDirectLaborMinor = 0;
  let totalMachineOverheadMinor = Math.round(recipe.overhead_flat_minor * scale);
  const routingsCost: CostBreakdownDto['routingsCost'] = [];

  for (const r of recipe.routings) {
    const batchUnits = batchQty / 10000;
    const totalMinutes = r.setup_time_mins + (r.run_time_mins_scaled / 10000) * batchUnits;
    const hours = totalMinutes / 60;
    const stepLabor = Math.round(hours * r.labor_headcount * r.labor_rate_minor);
    const stepMachine = Math.round(hours * r.overhead_rate_minor);

    totalDirectLaborMinor += stepLabor;
    totalMachineOverheadMinor += stepMachine;

    routingsCost.push({
      stepOrder: r.step_order,
      stepNameEn: r.name_en,
      workCenterCode: r.work_center_code,
      laborCostMinor: stepLabor,
      machineCostMinor: stepMachine,
      totalStepCostMinor: stepLabor + stepMachine,
    });
  }

  const totalBatchCostMinor =
    totalDirectMaterialMinor +
    totalDirectLaborMinor +
    totalMachineOverheadMinor -
    byproductCreditMinor;

  const yieldPct = (recipe.expected_yield_pct_scaled || 1000000) / 1000000;
  const expectedYieldQtyScaled = Math.round(batchQty * yieldPct);
  const expectedYieldUnits = expectedYieldQtyScaled / 10000;
  const unitCostMinor =
    expectedYieldUnits > 0 ? Math.round(totalBatchCostMinor / expectedYieldUnits) : 0;

  return {
    recipeId: recipe.id,
    baseQuantityScaled: batchQty,
    totalDirectMaterialMinor,
    totalDirectLaborMinor,
    totalMachineOverheadMinor,
    byproductCreditMinor,
    totalBatchCostMinor,
    unitCostMinor,
    expectedYieldQtyScaled,
    itemsCost,
    routingsCost,
  };
}

/**
 * LocalStorage persistent client implementation
 */
export class PersistentLabClient implements LabApiClient {
  private data: LabPersistentData;
  private readonly storageKey: string;

  constructor(storageKey = STORAGE_KEY_V1) {
    this.storageKey = storageKey;
    this.data = this.loadFromStorage();
  }

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
    return null;
  }

  private loadFromStorage(): LabPersistentData {
    const storage = this.getStorage();
    if (!storage) {
      // In non-browser environments without storage, return deep clone of seed
      return JSON.parse(JSON.stringify(SEED_DATA));
    }

    try {
      const stored = storage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as LabPersistentData;
        if (parsed && parsed.schemaVersion === 1) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse localStorage data, initializing default seed', e);
    }

    // Default: initialize with SEED_DATA and persist
    const initData = JSON.parse(JSON.stringify(SEED_DATA));
    this.saveToStorage(initData);
    return initData;
  }

  private saveToStorage(data: LabPersistentData): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(this.storageKey, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to write to localStorage', e);
      }
    }
    this.data = data;
  }

  private persist(): void {
    this.saveToStorage(this.data);
  }

  // --- ITEMS API ---
  public items = {
    list: async (filter?: { type?: ItemType; isActive?: boolean }): Promise<ItemDto[]> => {
      let list = [...this.data.items];
      if (filter?.type) {
        list = list.filter((i) => i.type === filter.type);
      }
      if (filter?.isActive !== undefined) {
        list = list.filter((i) => i.is_active === filter.isActive);
      }
      return list;
    },
    get: async (id: string): Promise<ItemDto | null> => {
      return this.data.items.find((i) => i.id === id || i.code === id) ?? null;
    },
    create: async (dto: CreateItemDto): Promise<ItemDto> => {
      const existing = this.data.items.find((i) => i.code.toLowerCase() === dto.code.toLowerCase());
      if (existing) {
        throw new Error(`Item with code ${dto.code} already exists`);
      }
      const now = new Date().toISOString();
      const item: ItemDto = {
        id: `itm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        code: dto.code.trim().toUpperCase(),
        name_ar: dto.name_ar,
        name_en: dto.name_en,
        type: dto.type,
        uom_code: dto.uom_code,
        cost_minor: dto.cost_minor ?? 0,
        reorder_point_scaled: dto.reorder_point_scaled ?? 0,
        is_active: dto.is_active ?? true,
        created_at: now,
        updated_at: now,
      };
      this.data.items.unshift(item);
      this.persist();
      return item;
    },
    update: async (id: string, dto: UpdateItemDto): Promise<ItemDto> => {
      const idx = this.data.items.findIndex((i) => i.id === id);
      if (idx === -1) {
        throw new Error(`Item ${id} not found`);
      }
      const current = this.data.items[idx];
      if (!current) throw new Error(`Item ${id} not found`);

      if (dto.code && dto.code.toLowerCase() !== current.code.toLowerCase()) {
        const conflict = this.data.items.find(
          (i) => i.id !== id && i.code.toLowerCase() === dto.code?.toLowerCase(),
        );
        if (conflict) {
          throw new Error(`Item code ${dto.code} already in use`);
        }
      }

      const updated: ItemDto = {
        ...current,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name_ar ? { name_ar: dto.name_ar } : {}),
        ...(dto.name_en ? { name_en: dto.name_en } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.uom_code ? { uom_code: dto.uom_code } : {}),
        ...(dto.cost_minor !== undefined ? { cost_minor: dto.cost_minor } : {}),
        ...(dto.reorder_point_scaled !== undefined
          ? { reorder_point_scaled: dto.reorder_point_scaled }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        updated_at: new Date().toISOString(),
      };
      this.data.items[idx] = updated;
      this.persist();
      return updated;
    },
    delete: async (id: string): Promise<{ deleted: boolean }> => {
      const initialLen = this.data.items.length;
      this.data.items = this.data.items.filter((i) => i.id !== id);
      if (this.data.items.length !== initialLen) {
        this.persist();
        return { deleted: true };
      }
      return { deleted: false };
    },
  };

  // --- WORK CENTERS API ---
  public workCenters = {
    list: async (industry?: IndustryVertical): Promise<WorkCenterDto[]> => {
      if (!industry) return [...this.data.workCenters];
      return this.data.workCenters.filter((wc) => wc.industry_vertical === industry);
    },
    get: async (id: string): Promise<WorkCenterDto | null> => {
      return this.data.workCenters.find((wc) => wc.id === id || wc.code === id) ?? null;
    },
    create: async (dto: CreateWorkCenterDto): Promise<WorkCenterDto> => {
      const existing = this.data.workCenters.find(
        (wc) => wc.code.toLowerCase() === dto.code.toLowerCase(),
      );
      if (existing) {
        throw new Error(`Work center with code ${dto.code} already exists`);
      }
      const wc: WorkCenterDto = {
        id: `wc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        code: dto.code.trim().toUpperCase(),
        name_ar: dto.name_ar,
        name_en: dto.name_en,
        industry_vertical: dto.industry_vertical,
        labor_rate_minor: dto.labor_rate_minor,
        overhead_rate_minor: dto.overhead_rate_minor,
        capacity_per_hour_scaled: dto.capacity_per_hour_scaled ?? 10000,
        is_active: dto.is_active ?? true,
        created_at: new Date().toISOString(),
      };
      this.data.workCenters.unshift(wc);
      this.persist();
      return wc;
    },
    update: async (id: string, dto: UpdateWorkCenterDto): Promise<WorkCenterDto> => {
      const idx = this.data.workCenters.findIndex((wc) => wc.id === id);
      if (idx === -1) {
        throw new Error(`Work center ${id} not found`);
      }
      const current = this.data.workCenters[idx];
      if (!current) throw new Error(`Work center ${id} not found`);

      if (dto.code && dto.code.toLowerCase() !== current.code.toLowerCase()) {
        const conflict = this.data.workCenters.find(
          (wc) => wc.id !== id && wc.code.toLowerCase() === dto.code?.toLowerCase(),
        );
        if (conflict) {
          throw new Error(`Work center code ${dto.code} already in use`);
        }
      }

      const updated: WorkCenterDto = {
        ...current,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name_ar ? { name_ar: dto.name_ar } : {}),
        ...(dto.name_en ? { name_en: dto.name_en } : {}),
        ...(dto.industry_vertical ? { industry_vertical: dto.industry_vertical } : {}),
        ...(dto.labor_rate_minor !== undefined ? { labor_rate_minor: dto.labor_rate_minor } : {}),
        ...(dto.overhead_rate_minor !== undefined
          ? { overhead_rate_minor: dto.overhead_rate_minor }
          : {}),
        ...(dto.capacity_per_hour_scaled !== undefined
          ? { capacity_per_hour_scaled: dto.capacity_per_hour_scaled }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      };
      this.data.workCenters[idx] = updated;
      this.persist();
      return updated;
    },
    delete: async (id: string): Promise<{ deleted: boolean }> => {
      const initialLen = this.data.workCenters.length;
      this.data.workCenters = this.data.workCenters.filter((wc) => wc.id !== id);
      if (this.data.workCenters.length !== initialLen) {
        this.persist();
        return { deleted: true };
      }
      return { deleted: false };
    },
  };

  // --- RECIPES API ---
  public recipes = {
    list: async (industry?: IndustryVertical): Promise<RecipeDto[]> => {
      if (!industry) return [...this.data.recipes];
      return this.data.recipes.filter((r) => r.industry_vertical === industry);
    },
    get: async (id: string): Promise<RecipeDto | null> => {
      return this.data.recipes.find((r) => r.id === id || r.code === id) ?? null;
    },
    create: async (dto: CreateRecipeDto): Promise<RecipeDto> => {
      const outputItem = this.data.items.find((i) => i.id === dto.output_item_id);
      if (!outputItem) {
        throw new Error(`Output item ${dto.output_item_id} not found`);
      }

      const items: RecipeItemDto[] = (dto.items ?? []).map((it, idx) => {
        const itemMaster = this.data.items.find((i) => i.id === it.item_id);
        return {
          id: `ri-${Date.now()}-${idx}`,
          item_id: it.item_id,
          item_code: itemMaster?.code ?? it.item_id,
          item_name_ar: itemMaster?.name_ar ?? '',
          item_name_en: itemMaster?.name_en ?? '',
          uom_code: itemMaster?.uom_code ?? 'PCS',
          unit_cost_minor: itemMaster?.cost_minor ?? 0,
          quantity_scaled: it.quantity_scaled,
          scrap_tolerance_pct_scaled: it.scrap_tolerance_pct_scaled ?? 0,
          notes: it.notes,
        };
      });

      const byproducts: RecipeByproductDto[] = (dto.byproducts ?? []).map((bp, idx) => {
        const bpItem = this.data.items.find((i) => i.id === bp.item_id);
        return {
          id: `rb-${Date.now()}-${idx}`,
          item_id: bp.item_id,
          item_code: bpItem?.code ?? bp.item_id,
          item_name_ar: bpItem?.name_ar ?? '',
          item_name_en: bpItem?.name_en ?? '',
          uom_code: bpItem?.uom_code ?? 'KG',
          yield_quantity_scaled: bp.yield_quantity_scaled,
          salvage_value_minor: bp.salvage_value_minor ?? 0,
          notes: bp.notes,
        };
      });

      const routings: RecipeRoutingDto[] = (dto.routings ?? []).map((ro, idx) => {
        const wc = this.data.workCenters.find((w) => w.code === ro.work_center_code);
        return {
          id: `rr-${Date.now()}-${idx}`,
          work_center_code: ro.work_center_code,
          work_center_name_ar: wc?.name_ar ?? ro.work_center_code,
          work_center_name_en: wc?.name_en ?? ro.work_center_code,
          step_order: ro.step_order,
          name_ar: ro.name_ar,
          name_en: ro.name_en,
          setup_time_mins: ro.setup_time_mins,
          run_time_mins_scaled: ro.run_time_mins_scaled,
          labor_headcount: ro.labor_headcount,
          labor_rate_minor: wc?.labor_rate_minor ?? 0,
          overhead_rate_minor: wc?.overhead_rate_minor ?? 0,
        };
      });

      const now = new Date().toISOString();
      const recipe: RecipeDto = {
        id: `rcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        code: dto.code.trim().toUpperCase(),
        name_ar: dto.name_ar,
        name_en: dto.name_en,
        industry_vertical: dto.industry_vertical,
        output_item_id: outputItem.id,
        output_item_code: outputItem.code,
        output_item_name_ar: outputItem.name_ar,
        output_item_name_en: outputItem.name_en,
        output_uom: outputItem.uom_code,
        base_quantity_scaled: dto.base_quantity_scaled,
        expected_yield_pct_scaled: dto.expected_yield_pct_scaled ?? 1000000,
        overhead_flat_minor: dto.overhead_flat_minor ?? 0,
        version: 1,
        is_active: true,
        items,
        byproducts,
        routings,
        created_at: now,
        updated_at: now,
      };

      this.data.recipes.unshift(recipe);
      this.persist();
      return recipe;
    },
    update: async (id: string, dto: UpdateRecipeDto): Promise<RecipeDto> => {
      const idx = this.data.recipes.findIndex((r) => r.id === id);
      if (idx === -1) {
        throw new Error(`Recipe ${id} not found`);
      }
      const current = this.data.recipes[idx];
      if (!current) throw new Error(`Recipe ${id} not found`);

      let outputItem = this.data.items.find((i) => i.id === current.output_item_id);
      if (dto.output_item_id) {
        outputItem = this.data.items.find((i) => i.id === dto.output_item_id);
        if (!outputItem) {
          throw new Error(`Output item ${dto.output_item_id} not found`);
        }
      }

      let items = current.items;
      if (dto.items) {
        items = dto.items.map((it, i) => {
          const itemMaster = this.data.items.find((im) => im.id === it.item_id);
          return {
            id: `ri-${Date.now()}-${i}`,
            item_id: it.item_id,
            item_code: itemMaster?.code ?? it.item_id,
            item_name_ar: itemMaster?.name_ar ?? '',
            item_name_en: itemMaster?.name_en ?? '',
            uom_code: itemMaster?.uom_code ?? 'PCS',
            unit_cost_minor: itemMaster?.cost_minor ?? 0,
            quantity_scaled: it.quantity_scaled,
            scrap_tolerance_pct_scaled: it.scrap_tolerance_pct_scaled ?? 0,
            notes: it.notes,
          };
        });
      }

      let byproducts = current.byproducts;
      if (dto.byproducts) {
        byproducts = dto.byproducts.map((bp, i) => {
          const bpItem = this.data.items.find((im) => im.id === bp.item_id);
          return {
            id: `rb-${Date.now()}-${i}`,
            item_id: bp.item_id,
            item_code: bpItem?.code ?? bp.item_id,
            item_name_ar: bpItem?.name_ar ?? '',
            item_name_en: bpItem?.name_en ?? '',
            uom_code: bpItem?.uom_code ?? 'KG',
            yield_quantity_scaled: bp.yield_quantity_scaled,
            salvage_value_minor: bp.salvage_value_minor ?? 0,
            notes: bp.notes,
          };
        });
      }

      let routings = current.routings;
      if (dto.routings) {
        routings = dto.routings.map((ro, i) => {
          const wc = this.data.workCenters.find((w) => w.code === ro.work_center_code);
          return {
            id: `rr-${Date.now()}-${i}`,
            work_center_code: ro.work_center_code,
            work_center_name_ar: wc?.name_ar ?? ro.work_center_code,
            work_center_name_en: wc?.name_en ?? ro.work_center_code,
            step_order: ro.step_order,
            name_ar: ro.name_ar,
            name_en: ro.name_en,
            setup_time_mins: ro.setup_time_mins,
            run_time_mins_scaled: ro.run_time_mins_scaled,
            labor_headcount: ro.labor_headcount,
            labor_rate_minor: wc?.labor_rate_minor ?? 0,
            overhead_rate_minor: wc?.overhead_rate_minor ?? 0,
          };
        });
      }

      const updated: RecipeDto = {
        ...current,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name_ar ? { name_ar: dto.name_ar } : {}),
        ...(dto.name_en ? { name_en: dto.name_en } : {}),
        ...(dto.industry_vertical ? { industry_vertical: dto.industry_vertical } : {}),
        ...(outputItem
          ? {
              output_item_id: outputItem.id,
              output_item_code: outputItem.code,
              output_item_name_ar: outputItem.name_ar,
              output_item_name_en: outputItem.name_en,
              output_uom: outputItem.uom_code,
            }
          : {}),
        ...(dto.base_quantity_scaled !== undefined
          ? { base_quantity_scaled: dto.base_quantity_scaled }
          : {}),
        ...(dto.expected_yield_pct_scaled !== undefined
          ? { expected_yield_pct_scaled: dto.expected_yield_pct_scaled }
          : {}),
        ...(dto.overhead_flat_minor !== undefined
          ? { overhead_flat_minor: dto.overhead_flat_minor }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        items,
        byproducts,
        routings,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      };

      this.data.recipes[idx] = updated;
      this.persist();
      return updated;
    },
    delete: async (id: string): Promise<{ deleted: boolean }> => {
      const initialLen = this.data.recipes.length;
      this.data.recipes = this.data.recipes.filter((r) => r.id !== id);
      if (this.data.recipes.length !== initialLen) {
        this.persist();
        return { deleted: true };
      }
      return { deleted: false };
    },
    calculateCost: async (id: string, batchQtyScaled?: number): Promise<CostBreakdownDto> => {
      const recipe = this.data.recipes.find((r) => r.id === id);
      if (!recipe) throw new Error(`Recipe ${id} not found`);
      return computeRecipeCost(recipe, batchQtyScaled);
    },
  };

  // --- WORK ORDERS API ---
  public workOrders = {
    list: async (status?: WorkOrderStatus): Promise<WorkOrderRow[]> => {
      if (!status) return [...this.data.workOrders];
      return this.data.workOrders.filter((wo) => wo.status === status);
    },
    get: async (id: string): Promise<WorkOrderRow | null> => {
      return this.data.workOrders.find((wo) => wo.id === id || wo.order_number === id) ?? null;
    },
    create: async (dto: CreateWorkOrderDto): Promise<WorkOrderRow> => {
      const item = this.data.items.find((i) => i.id === dto.itemId || i.code === dto.itemId);
      const itemName = item ? (item.name_ar ? `${item.name_ar} (${item.code})` : item.code) : dto.itemId;
      const now = new Date().toISOString();

      const newRow: WorkOrderRow = {
        id: `wo-${Date.now()}`,
        order_number: dto.orderNumber,
        item_id: dto.itemId,
        item_name: itemName,
        target_lot_id: dto.targetLotId ?? null,
        planned_quantity_scaled: dto.plannedQuantityScaled,
        yield_quantity_scaled: 0,
        scrap_quantity_scaled: 0,
        status: 'DRAFT',
        qc_status: 'QUARANTINE',
        due_date: dto.dueDate,
        notes: dto.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      this.data.workOrders.unshift(newRow);
      this.persist();
      return newRow;
    },
    release: async (id: string): Promise<WorkOrderRow> => {
      const row = this.data.workOrders.find((r) => r.id === id);
      if (!row) throw new Error(`Work order ${id} not found`);
      if (row.status !== 'DRAFT') {
        throw new Error(`Cannot release work order in status ${row.status}`);
      }
      row.status = 'RELEASED';
      row.updated_at = new Date().toISOString();
      this.persist();
      return { ...row };
    },
    start: async (id: string): Promise<WorkOrderRow> => {
      const row = this.data.workOrders.find((r) => r.id === id);
      if (!row) throw new Error(`Work order ${id} not found`);
      if (row.status !== 'RELEASED' && row.status !== 'DRAFT') {
        throw new Error(`Cannot start work order in status ${row.status}`);
      }
      row.status = 'IN_PROGRESS';
      row.updated_at = new Date().toISOString();
      this.persist();
      return { ...row };
    },
    complete: async (id: string, params: CompleteWorkOrderDto): Promise<WorkOrderRow> => {
      const row = this.data.workOrders.find((r) => r.id === id);
      if (!row) throw new Error(`Work order ${id} not found`);
      if (row.status !== 'IN_PROGRESS' && row.status !== 'RELEASED') {
        throw new Error(`Cannot complete work order in status ${row.status}`);
      }

      row.status = 'COMPLETED';
      row.yield_quantity_scaled = params.yieldQuantityScaled;
      row.scrap_quantity_scaled = params.scrapQuantityScaled;
      row.target_lot_id = params.targetLotId;
      row.updated_at = new Date().toISOString();

      // Ensure lot exists for the finished good
      let lot = this.data.lots.find((l) => l.id === params.targetLotId);
      if (!lot) {
        lot = {
          id: params.targetLotId,
          lot_number: `LT-${Date.now().toString().slice(-6)}`,
          item_id: row.item_id,
          manufacture_date: new Date().toISOString().slice(0, 10),
          expiry_date: null,
          qc_status: 'QUARANTINE',
          created_at: new Date().toISOString(),
        };
        this.data.lots.push(lot);
      }

      // Record production yield movement into inventory
      if (params.yieldQuantityScaled > 0) {
        this.data.movements.push({
          id: `mov-${Date.now()}-yd`,
          movement_type: 'PRODUCTION_YIELD',
          item_id: row.item_id,
          lot_id: lot.id,
          location_id: params.targetLocationId,
          quantity_scaled: params.yieldQuantityScaled,
          unit_cost_minor: params.unitCostMinor ?? 0,
          reference_type: 'WORK_ORDER',
          reference_id: row.id,
          actor_id: 'client-user',
          created_at: new Date().toISOString(),
        });
      }

      this.persist();
      return { ...row };
    },
    cancel: async (id: string, reason?: string): Promise<WorkOrderRow> => {
      const row = this.data.workOrders.find((r) => r.id === id);
      if (!row) throw new Error(`Work order ${id} not found`);
      if (row.status === 'COMPLETED') {
        throw new Error('Cannot cancel a completed work order');
      }
      row.status = 'CANCELLED';
      if (reason) {
        row.notes = row.notes ? `${row.notes} | CANCELLED: ${reason}` : `CANCELLED: ${reason}`;
      }
      row.updated_at = new Date().toISOString();
      this.persist();
      return { ...row };
    },
    addConsumption: async (dto: AddConsumptionDto): Promise<WorkOrderConsumptionRecord> => {
      const wo = this.data.workOrders.find((r) => r.id === dto.workOrderId);
      if (!wo) throw new Error(`Work order ${dto.workOrderId} not found`);

      // Verify stock availability
      const currentStock = this.computeBalance(dto.itemId, dto.lotId, dto.locationId);
      if (currentStock < BigInt(dto.quantityScaled)) {
        throw new Error(
          `Insufficient stock for item ${dto.itemId}, lot ${dto.lotId} at location ${dto.locationId}. Current: ${currentStock}, Requested: ${dto.quantityScaled}`,
        );
      }

      const rec: WorkOrderConsumptionRecord = {
        id: `woc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        work_order_id: dto.workOrderId,
        item_id: dto.itemId,
        lot_id: dto.lotId,
        location_id: dto.locationId,
        quantity_scaled: dto.quantityScaled,
        unit_cost_minor: dto.unitCostMinor ?? 0,
        recorded_at: new Date().toISOString(),
      };

      this.data.workOrderConsumptions.push(rec);

      // Inventory movement for material consumption
      this.data.movements.push({
        id: `mov-${Date.now()}-cs`,
        movement_type: 'PRODUCTION_CONSUME',
        item_id: dto.itemId,
        lot_id: dto.lotId,
        location_id: dto.locationId,
        quantity_scaled: -Math.abs(dto.quantityScaled),
        unit_cost_minor: dto.unitCostMinor ?? 0,
        reference_type: 'WORK_ORDER',
        reference_id: dto.workOrderId,
        actor_id: 'client-user',
        created_at: new Date().toISOString(),
      });

      this.persist();
      return rec;
    },
  };

  // --- INVENTORY API ---
  private computeBalance(itemId: string, lotId?: string, locationId?: string): bigint {
    let bal = 0n;
    for (const m of this.data.movements) {
      if (m.item_id !== itemId) continue;
      if (lotId && m.lot_id !== lotId) continue;
      if (locationId && m.location_id !== locationId) continue;
      bal += BigInt(m.quantity_scaled);
    }
    return bal;
  }

  public inventory = {
    listLots: async (itemId?: string): Promise<LotDto[]> => {
      if (!itemId) return [...this.data.lots];
      return this.data.lots.filter((l) => l.item_id === itemId);
    },
    getStockOnHand: async (itemId?: string): Promise<StockOnHandDto[]> => {
      const itemsToQuery = itemId
        ? this.data.items.filter((i) => i.id === itemId)
        : this.data.items;

      const results: StockOnHandDto[] = [];

      for (const item of itemsToQuery) {
        // Group by lot and location
        const lotMap = new Map<
          string,
          {
            lotId: string;
            lotNumber: string;
            qcStatus: QcStatus;
            locationId: string;
            quantityScaled: number;
          }
        >();

        let itemTotal = 0;

        for (const mov of this.data.movements) {
          if (mov.item_id !== item.id) continue;
          itemTotal += mov.quantity_scaled;
          const key = `${mov.lot_id}::${mov.location_id}`;
          const existing = lotMap.get(key);
          if (existing) {
            existing.quantityScaled += mov.quantity_scaled;
          } else {
            const lot = this.data.lots.find((l) => l.id === mov.lot_id);
            lotMap.set(key, {
              lotId: mov.lot_id,
              lotNumber: lot?.lot_number ?? mov.lot_id,
              qcStatus: lot?.qc_status ?? 'QUARANTINE',
              locationId: mov.location_id,
              quantityScaled: mov.quantity_scaled,
            });
          }
        }

        results.push({
          itemId: item.id,
          itemCode: item.code,
          itemNameAr: item.name_ar,
          itemNameEn: item.name_en,
          uomCode: item.uom_code,
          totalQuantityScaled: itemTotal,
          byLot: Array.from(lotMap.values()).filter((l) => l.quantityScaled > 0),
        });
      }

      return results;
    },
    getBalance: async (itemId: string, lotId?: string, locationId?: string): Promise<string> => {
      const balance = this.computeBalance(itemId, lotId, locationId);
      return balance.toString();
    },
    recordMovement: async (dto: RecordMovementDto): Promise<InventoryMovementDto> => {
      const qty = dto.quantityScaled;
      if (qty === 0) {
        throw new Error('Movement quantity cannot be zero');
      }

      // Enforce non-negative inventory for stock outgoing
      if (qty < 0) {
        const cur = this.computeBalance(dto.itemId, dto.lotId, dto.locationId);
        if (cur + BigInt(qty) < 0n) {
          throw new Error(
            `Insufficient stock for item ${dto.itemId}, lot ${dto.lotId} at location ${dto.locationId}. Current: ${cur}, Requested: ${qty}`,
          );
        }
      }

      const mov: InventoryMovementDto = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        movement_type: dto.movementType,
        item_id: dto.itemId,
        lot_id: dto.lotId,
        location_id: dto.locationId,
        quantity_scaled: dto.quantityScaled,
        unit_cost_minor: dto.unitCostMinor ?? 0,
        reference_type: dto.referenceType ?? null,
        reference_id: dto.referenceId ?? null,
        actor_id: dto.actorId ?? 'system',
        created_at: new Date().toISOString(),
      };

      this.data.movements.push(mov);

      // If moving average cost should be updated on standard incoming receipt
      if (qty > 0 && dto.unitCostMinor && dto.unitCostMinor > 0) {
        const item = this.data.items.find((i) => i.id === dto.itemId);
        if (item) {
          const priorBal = this.computeBalance(dto.itemId) - BigInt(qty);
          if (priorBal > 0n) {
            const currentTotalValue = priorBal * BigInt(item.cost_minor);
            const incomingTotalValue = BigInt(qty) * BigInt(dto.unitCostMinor);
            const newTotalQty = priorBal + BigInt(qty);
            item.cost_minor = Number((currentTotalValue + incomingTotalValue) / newTotalQty);
          } else {
            item.cost_minor = dto.unitCostMinor;
          }
          item.updated_at = new Date().toISOString();
        }
      }

      this.persist();
      return mov;
    },
    listStockBalances: async (): Promise<StockBalanceRow[]> => {
      const locNames: Record<string, { ar: string; en: string; type: string; code: string }> = {
        'loc-raw-main': { ar: 'مستودع المواد الخام', en: 'Raw Warehouse', type: 'WAREHOUSE', code: 'LOC-RAW' },
        'loc-cold-room': { ar: 'غرفة التبريد المركزية', en: 'Central Cold Room', type: 'COLD_ROOM', code: 'LOC-COLD' },
        'loc-textile-mat': { ar: 'مستودع الأقمشة والغزول', en: 'Textile Fabric Warehouse', type: 'WAREHOUSE', code: 'LOC-TEX-RAW' },
        'loc-prod-line-1': { ar: 'خط الإنتاج والطبخ 1', en: 'Food Cooking Line 1', type: 'PRODUCTION', code: 'LOC-PRD-1' },
        'loc-sewing-floor': { ar: 'صالة القص والحياكة', en: 'Cutting & Sewing Floor', type: 'PRODUCTION', code: 'LOC-SEW-1' },
        'loc-fg-main': { ar: 'مستودع المنتجات النهائية', en: 'Finished Goods Warehouse', type: 'WAREHOUSE', code: 'LOC-FG' },
        'loc-scrap-bay': { ar: 'منطقة الهدر والتوالف', en: 'Scrap & Waste Area', type: 'SCRAP', code: 'LOC-SCRAP' },
      };

      const map = new Map<string, StockBalanceRow>();

      for (const mov of this.data.movements) {
        const item = this.data.items.find((i) => i.id === mov.item_id);
        const lot = this.data.lots.find((l) => l.id === mov.lot_id);
        if (!item || !lot) continue;

        const locMeta = locNames[mov.location_id] ?? {
          ar: mov.location_id,
          en: mov.location_id,
          type: 'WAREHOUSE',
          code: mov.location_id,
        };

        const key = `${mov.item_id}::${mov.lot_id}::${mov.location_id}`;
        const existing = map.get(key);

        if (existing) {
          existing.quantityScaled += mov.quantity_scaled;
        } else {
          map.set(key, {
            itemId: item.id,
            itemCode: item.code,
            itemNameAr: item.name_ar,
            itemNameEn: item.name_en,
            itemType: item.type,
            uomCode: item.uom_code,
            unitCostMinor: item.cost_minor,
            lotId: lot.id,
            lotNumber: lot.lot_number,
            expiryDate: lot.expiry_date,
            qcStatus: lot.qc_status,
            locationId: mov.location_id,
            locationCode: locMeta.code,
            locationNameAr: locMeta.ar,
            locationNameEn: locMeta.en,
            locationType: locMeta.type,
            quantityScaled: mov.quantity_scaled,
            totalValueMinor: 0,
          });
        }
      }

      return Array.from(map.values())
        .filter((row) => row.quantityScaled > 0)
        .map((row) => ({
          ...row,
          totalValueMinor: Math.round((row.quantityScaled / 10000) * row.unitCostMinor),
        }));
    },
    receiveGoods: async (dto: GoodsReceiptDto): Promise<{ lotId: string; movementId: string }> => {
      let lot = this.data.lots.find((l) => l.lot_number === dto.lotNumber);
      let lotId = lot?.id;

      if (!lot) {
        lotId = `lot-${Date.now()}`;
        const item = this.data.items.find((i) => i.id === dto.itemId);
        const newLot: LotDto = {
          id: lotId,
          lot_number: dto.lotNumber,
          item_id: dto.itemId,
          item_code: item?.code,
          item_name_ar: item?.name_ar,
          item_name_en: item?.name_en,
          manufacture_date: dto.manufactureDate ?? (new Date().toISOString().split('T')[0] ?? null),
          expiry_date: dto.expiryDate ?? null,
          qc_status: dto.qcStatus ?? 'QUARANTINE',
          created_at: new Date().toISOString(),
        };
        this.data.lots.push(newLot);
        lot = newLot;
      }

      const mov = await this.inventory.recordMovement({
        movementType: 'RECEIPT',
        itemId: dto.itemId,
        lotId: lotId!,
        locationId: dto.locationId,
        quantityScaled: dto.quantityScaled,
        unitCostMinor: dto.unitCostMinor,
        referenceType: 'PURCHASE_RECEIPT',
      });

      return { lotId: lotId!, movementId: mov.id };
    },
    updateLotQc: async (lotId: string, qcStatus: QcStatus): Promise<LotDto> => {
      const lot = this.data.lots.find((l) => l.id === lotId || l.lot_number === lotId);
      if (!lot) throw new Error(`Lot ${lotId} not found`);
      lot.qc_status = qcStatus;

      // Also update linked work order if exists
      const linkedWo = this.data.workOrders.find((w) => w.target_lot_id === lotId);
      if (linkedWo) {
        linkedWo.qc_status = qcStatus;
        linkedWo.updated_at = new Date().toISOString();
      }

      this.persist();
      return { ...lot };
    },
    getDashboardMetrics: async (): Promise<DashboardMetricsDto> => {
      const balances = await this.inventory.listStockBalances();
      const totalValuationMinor = balances.reduce((sum, b) => sum + b.totalValueMinor, 0);

      const activeOrders = this.data.workOrders.filter(
        (w) => w.status === 'RELEASED' || w.status === 'IN_PROGRESS',
      );
      const activeWorkOrdersCount = activeOrders.length;
      const activeWorkOrdersWipMinor = activeOrders.reduce((sum, w) => {
        const item = this.data.items.find((i) => i.id === w.item_id);
        const cost = item ? item.cost_minor : 1250;
        return sum + Math.round((w.planned_quantity_scaled / 10000) * cost);
      }, 0);

      const completedOrders = this.data.workOrders.filter((w) => w.status === 'COMPLETED');
      let monthlyProductionYieldPct = 96.8;
      if (completedOrders.length > 0) {
        const totalPlanned = completedOrders.reduce((s, w) => s + w.planned_quantity_scaled, 0);
        const totalYield = completedOrders.reduce((s, w) => s + w.yield_quantity_scaled, 0);
        if (totalPlanned > 0) {
          monthlyProductionYieldPct = Math.round((totalYield / totalPlanned) * 1000) / 10;
        }
      }

      const varianceBreakdown = [
        {
          category: 'MATERIAL_DIRECT',
          categoryAr: 'المواد الخام المباشرة',
          categoryEn: 'Direct Materials',
          standardMinor: 4850000,
          actualMinor: 5020000,
          varianceMinor: 170000,
        },
        {
          category: 'LABOR_DIRECT',
          categoryAr: 'العمالة المباشرة',
          categoryEn: 'Direct Labor',
          standardMinor: 1600000,
          actualMinor: 1550000,
          varianceMinor: -50000,
        },
        {
          category: 'MACHINE_OVERHEAD',
          categoryAr: 'تكاليف المعدات غير المباشرة',
          categoryEn: 'Machine & Overhead',
          standardMinor: 950000,
          actualMinor: 990000,
          varianceMinor: 40000,
        },
        {
          category: 'SCRAP_LOSS',
          categoryAr: 'هدر وتوالف التشغيل',
          categoryEn: 'Scrap & Shrinkage',
          standardMinor: 240000,
          actualMinor: 210000,
          varianceMinor: -30000,
        },
      ];

      const costVarianceMinor = varianceBreakdown.reduce((s, v) => s + v.varianceMinor, 0);

      return {
        totalValuationMinor,
        activeWorkOrdersWipMinor,
        activeWorkOrdersCount,
        monthlyProductionYieldPct,
        costVarianceMinor,
        varianceBreakdown,
      };
    },
  };

  // --- SYSTEM BACKUP / RESTORE API ---
  public system = {
    exportData: (): LabPersistentData => {
      return JSON.parse(JSON.stringify(this.data));
    },
    importData: (data: LabPersistentData): void => {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup data format');
      }
      if (data.schemaVersion !== 1) {
        throw new Error(`Unsupported schema version: ${data.schemaVersion}`);
      }
      this.saveToStorage(JSON.parse(JSON.stringify(data)));
    },
    resetToEmpty: (): void => {
      this.saveToStorage(JSON.parse(JSON.stringify(EMPTY_SYSTEM_DATA)));
    },
    seedDefaultData: (): void => {
      this.saveToStorage(JSON.parse(JSON.stringify(SEED_DATA)));
    },
  };
}

export const persistentClient = new PersistentLabClient();

export const api: LabApiClient =
  typeof window !== 'undefined' && (window as unknown as { labApi?: LabApiClient }).labApi
    ? (window as unknown as { labApi: LabApiClient }).labApi
    : persistentClient;
