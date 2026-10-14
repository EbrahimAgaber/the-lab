import { z } from 'zod';

// ============================================================================
// Core RPC Envelope & Error Model
// ============================================================================

export type RpcErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'PRECONDITION_FAILED'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export interface RpcErrorPayload {
  code: RpcErrorCode;
  messageKey: string;
  message?: string;
  params?: Record<string, unknown>;
}

export class RpcError extends Error {
  public readonly code: RpcErrorCode;
  public readonly messageKey: string;
  public readonly params?: Record<string, unknown>;

  constructor(code: RpcErrorCode, messageKey: string, message?: string, params?: Record<string, unknown>) {
    super(message || messageKey);
    this.name = 'RpcError';
    this.code = code;
    this.messageKey = messageKey;
    this.params = params;
  }

  toJSON(): RpcErrorPayload {
    return {
      code: this.code,
      messageKey: this.messageKey,
      message: this.message,
      params: this.params,
    };
  }
}

export interface SessionContext {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
  capabilities: string[];
}

export type IndustryVertical = 'FOOD_BEV' | 'GENERAL';
export type ItemType = 'RAW' | 'PACKAGING' | 'INTERMEDIATE' | 'FINISHED';
export type LocationType = 'WAREHOUSE' | 'COLD_ROOM' | 'PRODUCTION' | 'QUARANTINE' | 'SCRAP';
export type QcStatus = 'QUARANTINE' | 'RELEASED' | 'REJECTED' | 'HOLD';
export type WorkOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'PRODUCTION_CONSUME'
  | 'PRODUCTION_YIELD'
  | 'SCRAP';

// ============================================================================
// 1. Catalog / Master Data Schemas & Types
// ============================================================================

export const ItemSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  type: z.enum(['RAW', 'PACKAGING', 'INTERMEDIATE', 'FINISHED']),
  uom_code: z.string(),
  cost_minor: z.number().int(), // Halalas
  selling_price_minor: z.number().int().optional().default(0),
  reorder_point_scaled: z.number().int().default(0), // 10,000 scale
  barcode: z.string().nullable().optional(),
  shelf_life_days: z.number().int().nullable().optional(),
  lot_tracked: z.boolean().default(true),
  expiry_tracked: z.boolean().default(true),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ItemDto = z.infer<typeof ItemSchema>;

export const CreateItemInputSchema = z.object({
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  type: z.enum(['RAW', 'PACKAGING', 'INTERMEDIATE', 'FINISHED']),
  uom_code: z.string().min(1),
  cost_minor: z.number().int().optional().default(0),
  selling_price_minor: z.number().int().optional().default(0),
  reorder_point_scaled: z.number().int().optional().default(0),
  barcode: z.string().optional(),
  shelf_life_days: z.number().int().optional(),
  lot_tracked: z.boolean().optional().default(true),
  expiry_tracked: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
});
export type CreateItemDto = z.input<typeof CreateItemInputSchema>;

export const UpdateItemInputSchema = CreateItemInputSchema.partial();
export type UpdateItemDto = z.input<typeof UpdateItemInputSchema>;

export const WorkCenterSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  industry_vertical: z.enum(['FOOD_BEV', 'GENERAL']),
  labor_rate_minor: z.number().int(),
  overhead_rate_minor: z.number().int(),
  capacity_per_hour_scaled: z.number().int().default(10000),
  is_active: z.boolean().default(true),
  created_at: z.string(),
});
export type WorkCenterDto = z.infer<typeof WorkCenterSchema>;

export const CreateWorkCenterInputSchema = z.object({
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  industry_vertical: z.enum(['FOOD_BEV', 'GENERAL']).default('FOOD_BEV'),
  labor_rate_minor: z.number().int(),
  overhead_rate_minor: z.number().int(),
  capacity_per_hour_scaled: z.number().int().optional().default(10000),
  is_active: z.boolean().optional().default(true),
});
export type CreateWorkCenterDto = z.input<typeof CreateWorkCenterInputSchema>;

export const UpdateWorkCenterInputSchema = CreateWorkCenterInputSchema.partial();
export type UpdateWorkCenterDto = z.input<typeof UpdateWorkCenterInputSchema>;

export const SupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  tax_number: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
});
export type SupplierDto = z.infer<typeof SupplierSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  code: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  type: z.enum(['WAREHOUSE', 'COLD_ROOM', 'PRODUCTION', 'QUARANTINE', 'SCRAP']),
  is_active: z.boolean().default(true),
  created_at: z.string(),
});
export type LocationDto = z.infer<typeof LocationSchema>;

// ============================================================================
// 2. Recipe & Costing Schemas & Types
// ============================================================================

export const RecipeItemSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  item_code: z.string(),
  item_name_ar: z.string(),
  item_name_en: z.string(),
  uom_code: z.string(),
  unit_cost_minor: z.number().int(),
  quantity_scaled: z.number().int(),
  scrap_tolerance_pct_scaled: z.number().int().default(0),
  notes: z.string().optional(),
});
export type RecipeItemDto = z.infer<typeof RecipeItemSchema>;

export const RecipeByproductSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  item_code: z.string(),
  item_name_ar: z.string(),
  item_name_en: z.string(),
  uom_code: z.string(),
  yield_quantity_scaled: z.number().int(),
  salvage_value_minor: z.number().int(),
  notes: z.string().optional(),
});
export type RecipeByproductDto = z.infer<typeof RecipeByproductSchema>;

export const RecipeRoutingSchema = z.object({
  id: z.string(),
  work_center_code: z.string(),
  work_center_name_ar: z.string(),
  work_center_name_en: z.string(),
  step_order: z.number().int(),
  name_ar: z.string(),
  name_en: z.string(),
  setup_time_mins: z.number().int().default(0),
  run_time_mins_scaled: z.number().int().default(0),
  labor_headcount: z.number().int().default(1),
  labor_rate_minor: z.number().int(),
  overhead_rate_minor: z.number().int(),
});
export type RecipeRoutingDto = z.infer<typeof RecipeRoutingSchema>;

export const RecipeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name_ar: z.string(),
  name_en: z.string(),
  industry_vertical: z.enum(['FOOD_BEV', 'GENERAL']),
  output_item_id: z.string(),
  output_item_code: z.string(),
  output_item_name_ar: z.string(),
  output_item_name_en: z.string(),
  output_uom: z.string(),
  base_quantity_scaled: z.number().int(),
  expected_yield_pct_scaled: z.number().int().default(1000000), // 100%
  overhead_flat_minor: z.number().int().default(0),
  version: z.number().int().default(1),
  is_active: z.boolean().default(true),
  items: z.array(RecipeItemSchema).default([]),
  byproducts: z.array(RecipeByproductSchema).default([]),
  routings: z.array(RecipeRoutingSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecipeDto = z.infer<typeof RecipeSchema>;

export const CreateRecipeInputSchema = z.object({
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  industry_vertical: z.enum(['FOOD_BEV', 'GENERAL']).default('FOOD_BEV'),
  output_item_id: z.string(),
  base_quantity_scaled: z.number().int().positive(),
  expected_yield_pct_scaled: z.number().int().optional().default(1000000),
  overhead_flat_minor: z.number().int().optional().default(0),
  items: z
    .array(
      z.object({
        item_id: z.string(),
        quantity_scaled: z.number().int().positive(),
        scrap_tolerance_pct_scaled: z.number().int().optional().default(0),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  byproducts: z
    .array(
      z.object({
        item_id: z.string(),
        yield_quantity_scaled: z.number().int().positive(),
        salvage_value_minor: z.number().int().optional().default(0),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  routings: z
    .array(
      z.object({
        work_center_code: z.string(),
        step_order: z.number().int(),
        name_ar: z.string(),
        name_en: z.string(),
        setup_time_mins: z.number().int().default(0),
        run_time_mins_scaled: z.number().int().default(0),
        labor_headcount: z.number().int().default(1),
      }),
    )
    .optional(),
});
export type CreateRecipeDto = z.input<typeof CreateRecipeInputSchema>;

export const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type UpdateRecipeDto = z.input<typeof UpdateRecipeInputSchema>;

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

// ============================================================================
// 3. Work Order Schemas & Types
// ============================================================================

export const WorkOrderSchema = z.object({
  id: z.string(),
  order_number: z.string(),
  item_id: z.string(),
  item_name: z.string().optional(),
  recipe_id: z.string().nullable().optional(),
  target_lot_id: z.string().nullable().optional(),
  lot_number: z.string().optional(),
  planned_quantity_scaled: z.number().int(),
  yield_quantity_scaled: z.number().int().default(0),
  scrap_quantity_scaled: z.number().int().default(0),
  status: z.enum(['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  qc_status: z.string().default('QUARANTINE'),
  due_date: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WorkOrderRow = z.infer<typeof WorkOrderSchema>;

export const CreateWorkOrderInputSchema = z.object({
  orderNumber: z.string().optional(), // Auto-generated if omitted
  itemId: z.string(),
  recipeId: z.string().optional(),
  plannedQuantityScaled: z.number().int().positive(),
  dueDate: z.string(),
  notes: z.string().optional(),
  targetLotId: z.string().nullable().optional(),
});
export type CreateWorkOrderDto = z.infer<typeof CreateWorkOrderInputSchema>;

export const CompleteWorkOrderInputSchema = z.object({
  yieldQuantityScaled: z.number().int(),
  scrapQuantityScaled: z.number().int().default(0),
  targetLotId: z.string().optional(),
  targetLocationId: z.string().optional().default('loc-raw-main'),
  unitCostMinor: z.number().int().optional(),
});
export type CompleteWorkOrderDto = z.infer<typeof CompleteWorkOrderInputSchema>;

export const AddConsumptionInputSchema = z.object({
  workOrderId: z.string(),
  itemId: z.string(),
  lotId: z.string(),
  locationId: z.string(),
  quantityScaled: z.number().int().positive(),
  unitCostMinor: z.number().int().optional(),
});
export type AddConsumptionDto = z.infer<typeof AddConsumptionInputSchema>;

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

// ============================================================================
// 4. Inventory, Lots & Stock Balances
// ============================================================================

export const LotSchema = z.object({
  id: z.string(),
  lot_number: z.string(),
  item_id: z.string(),
  item_code: z.string().optional(),
  item_name_ar: z.string().optional(),
  item_name_en: z.string().optional(),
  manufacture_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  qc_status: z.enum(['QUARANTINE', 'RELEASED', 'REJECTED', 'HOLD']),
  created_at: z.string(),
});
export type LotDto = z.infer<typeof LotSchema>;

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

export const GoodsReceiptInputSchema = z.object({
  itemId: z.string(),
  lotNumber: z.string().min(1),
  locationId: z.string(),
  quantityScaled: z.number().int().positive(),
  unitCostMinor: z.number().int().min(0),
  expiryDate: z.string().nullable().optional(),
  manufactureDate: z.string().nullable().optional(),
  qcStatus: z.enum(['QUARANTINE', 'RELEASED']).default('QUARANTINE'),
  supplierId: z.string().optional(),
  poId: z.string().optional(),
});
export type GoodsReceiptDto = z.input<typeof GoodsReceiptInputSchema>;

export const RecordMovementInputSchema = z.object({
  movementType: z.enum([
    'RECEIPT',
    'ISSUE',
    'TRANSFER',
    'ADJUSTMENT',
    'PRODUCTION_CONSUME',
    'PRODUCTION_YIELD',
    'SCRAP',
  ]),
  itemId: z.string(),
  lotId: z.string(),
  locationId: z.string(),
  quantityScaled: z.number().int(),
  unitCostMinor: z.number().int().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  actorId: z.string().optional(),
});
export type RecordMovementDto = z.infer<typeof RecordMovementInputSchema>;

export interface InventoryMovementDto {
  id: string;
  movement_type: MovementType;
  item_id: string;
  lot_id: string;
  location_id: string;
  quantity_scaled: number;
  unit_cost_minor: number;
  reference_type?: string | null;
  reference_id?: string | null;
  actor_id: string;
  created_at: string;
}

// ============================================================================
// 5. Auth, Security & System Setup
// ============================================================================

export interface UserDto {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  must_change_password: boolean;
  language: string;
  roles: string[];
  created_at: string;
}

export interface SetupStateDto {
  isSetupComplete: boolean;
  companyNameAr?: string;
  companyNameEn?: string;
  baseCurrency?: string;
}

export const CompleteSetupInputSchema = z.object({
  companyNameAr: z.string().min(2),
  companyNameEn: z.string().min(2),
  crNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  baseCurrency: z.string().default('SAR'),
  vatRatePct: z.number().default(15),
  adminUsername: z.string().min(3),
  adminDisplayName: z.string().min(2),
  adminPassword: z.string().min(6),
  defaultLanguage: z.enum(['ar', 'en']).default('ar'),
});
export type CompleteSetupDto = z.input<typeof CompleteSetupInputSchema>;

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginInputSchema>;

export interface LoginResultDto {
  token: string;
  user: UserDto;
  capabilities: string[];
}

// ============================================================================
// 6. Metrics & Reporting
// ============================================================================

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

export interface LotTraceNodeDto {
  lotId: string;
  lotNumber: string;
  itemId: string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn: string;
  qcStatus: string;
  quantityScaled: number;
  direction: 'PARENT' | 'CHILD';
  workOrderId?: string;
  workOrderNumber?: string;
  recordedAt: string;
}

export interface LotGenealogyDto {
  lot: LotDto;
  parents: LotTraceNodeDto[]; // Consumed in producing this lot
  children: LotTraceNodeDto[]; // Produced from this lot
}

// ============================================================================
// 7. Complete RPC Method Registry
// ============================================================================

export interface LabRpcMap {
  // System / Setup & Auth
  'admin.getSetupState': { params: void; result: SetupStateDto };
  'admin.completeSetup': { params: CompleteSetupDto; result: { success: boolean; user: UserDto } };
  'auth.login': { params: LoginDto; result: LoginResultDto };
  'auth.logout': { params: void; result: { success: boolean } };
  'auth.getMe': { params: void; result: { user: UserDto; capabilities: string[] } };

  // Master Data (Catalog)
  'catalog.items.list': { params: { type?: ItemType; isActive?: boolean } | void; result: ItemDto[] };
  'catalog.items.get': { params: { id: string }; result: ItemDto | null };
  'catalog.items.create': { params: CreateItemDto; result: ItemDto };
  'catalog.items.update': { params: { id: string; data: UpdateItemDto }; result: ItemDto };
  'catalog.items.delete': { params: { id: string }; result: { deleted: boolean } };

  'catalog.workCenters.list': { params: { industry?: IndustryVertical } | void; result: WorkCenterDto[] };
  'catalog.workCenters.get': { params: { id: string }; result: WorkCenterDto | null };
  'catalog.workCenters.create': { params: CreateWorkCenterDto; result: WorkCenterDto };
  'catalog.workCenters.update': { params: { id: string; data: UpdateWorkCenterDto }; result: WorkCenterDto };
  'catalog.workCenters.delete': { params: { id: string }; result: { deleted: boolean } };

  'catalog.suppliers.list': { params: void; result: SupplierDto[] };
  'catalog.locations.list': { params: void; result: LocationDto[] };

  // Recipes & Costing
  'manufacturing.recipes.list': { params: { industry?: IndustryVertical } | void; result: RecipeDto[] };
  'manufacturing.recipes.get': { params: { id: string }; result: RecipeDto | null };
  'manufacturing.recipes.create': { params: CreateRecipeDto; result: RecipeDto };
  'manufacturing.recipes.update': { params: { id: string; data: UpdateRecipeDto }; result: RecipeDto };
  'manufacturing.recipes.delete': { params: { id: string }; result: { deleted: boolean } };
  'manufacturing.recipes.calculateCost': { params: { id: string; batchQtyScaled?: number }; result: CostBreakdownDto };

  // Work Orders
  'manufacturing.workOrders.list': { params: { status?: WorkOrderStatus } | void; result: WorkOrderRow[] };
  'manufacturing.workOrders.get': { params: { id: string }; result: WorkOrderRow | null };
  'manufacturing.workOrders.create': { params: CreateWorkOrderDto; result: WorkOrderRow };
  'manufacturing.workOrders.release': { params: { id: string }; result: WorkOrderRow };
  'manufacturing.workOrders.start': { params: { id: string }; result: WorkOrderRow };
  'manufacturing.workOrders.complete': { params: { id: string; params: CompleteWorkOrderDto }; result: WorkOrderRow };
  'manufacturing.workOrders.cancel': { params: { id: string; reason?: string }; result: WorkOrderRow };
  'manufacturing.workOrders.addConsumption': { params: AddConsumptionDto; result: WorkOrderConsumptionRecord };

  // Inventory & Stock
  'inventory.lots.list': { params: { itemId?: string } | void; result: LotDto[] };
  'inventory.stock.getOnHand': { params: { itemId?: string } | void; result: StockOnHandDto[] };
  'inventory.stock.listBalances': { params: void; result: StockBalanceRow[] };
  'inventory.movements.record': { params: RecordMovementDto; result: InventoryMovementDto };
  'inventory.movements.receiveGoods': { params: GoodsReceiptDto; result: { lotId: string; movementId: string } };
  'inventory.lots.updateQc': { params: { lotId: string; qcStatus: QcStatus; notes?: string }; result: LotDto };
  'inventory.lots.getGenealogy': { params: { lotId: string }; result: LotGenealogyDto };

  // Dashboard & Reports
  'reports.dashboardMetrics': { params: void; result: DashboardMetricsDto };
  'admin.backup.create': { params: void; result: { backupId: string; timestamp: string; sizeBytes: number } };
}

export type RpcMethodName = keyof LabRpcMap;
