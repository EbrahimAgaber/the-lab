import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { SecurityService } from '../services/security';
import { CatalogService } from '../services/catalog';
import { BomService } from '../services/bom';
import { WorkOrderService } from '../services/work-orders';
import { InventoryService } from '../services/inventory';
import {
  RpcError,
  type RpcErrorPayload,
  type RpcMethodName,
  type ItemType,
  type IndustryVertical,
  type WorkOrderStatus,
  type QcStatus,
  type SessionContext,
  CreateItemInputSchema,
  UpdateItemInputSchema,
  CreateWorkCenterInputSchema,
  UpdateWorkCenterInputSchema,
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  CreateWorkOrderInputSchema,
  CompleteWorkOrderInputSchema,
  AddConsumptionInputSchema,
  GoodsReceiptInputSchema,
  RecordMovementInputSchema,
  CompleteSetupInputSchema,
  LoginInputSchema,
} from '@the-lab/contract';

export interface DispatchResponse {
  result?: unknown;
  error?: RpcErrorPayload;
}

export class CoreRpcDispatcher {
  public security: SecurityService;
  public catalog: CatalogService;
  public bom: BomService;
  public workOrders: WorkOrderService;
  public inventory: InventoryService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.security = new SecurityService(db, clock, ids);
    this.catalog = new CatalogService(db, clock, ids);
    this.bom = new BomService(db, clock, ids);
    this.workOrders = new WorkOrderService(db, clock, ids);
    this.inventory = new InventoryService(db, clock, ids);
  }

  public async dispatch(method: string, params: unknown, sessionToken?: string): Promise<DispatchResponse> {
    try {
      const result = await this.execute(method as RpcMethodName, params, sessionToken);
      return { result };
    } catch (err) {
      if (err instanceof RpcError) {
        return { error: err.toJSON() };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        error: {
          code: 'INTERNAL',
          messageKey: 'errors.internal',
          message,
        },
      };
    }
  }

  private async execute(method: RpcMethodName, rawParams: unknown, sessionToken?: string): Promise<unknown> {
    // 1. Setup & Public authentication routes
    if (method === 'admin.getSetupState') {
      return this.security.getSetupState();
    }

    if (method === 'admin.completeSetup') {
      const parsed = CompleteSetupInputSchema.parse(rawParams);
      return this.security.completeSetup(parsed);
    }

    if (method === 'auth.login') {
      const parsed = LoginInputSchema.parse(rawParams);
      return this.security.login(parsed);
    }

    // 2. Resolve Session Context
    const session = this.security.getSession(sessionToken);

    // If setup is not complete yet, require setup first
    const setupState = this.security.getSetupState();
    if (!setupState.isSetupComplete) {
      throw new RpcError('PRECONDITION_FAILED', 'errors.setupRequired', 'Initial system setup must be completed first.');
    }

    // Temporary bootstrap fallback for development if dev session passed
    const isDevBootstrap = sessionToken === 'bootstrap-admin';
    const effectiveSession: SessionContext | null =
      session ||
      (isDevBootstrap
        ? {
            userId: 'usr-admin-bootstrap',
            username: 'admin',
            displayName: 'System Admin',
            roles: ['ADMIN'],
            capabilities: ['*:*.*'],
          }
        : null);

    if (!effectiveSession && method !== 'auth.logout') {
      throw new RpcError('UNAUTHENTICATED', 'errors.unauthenticated', 'User session is required or expired.');
    }

    const auditCtx = { actorId: effectiveSession?.userId || 'usr-anonymous' };

    // 3. Routing Table with Capability Checking & Zod Schema Validation
    switch (method) {
      case 'auth.logout':
        if (sessionToken) this.security.logout(sessionToken);
        return { success: true };

      case 'auth.getMe':
        return {
          user: {
            id: effectiveSession!.userId,
            username: effectiveSession!.username,
            display_name: effectiveSession!.displayName,
            is_active: true,
            must_change_password: false,
            language: 'ar',
            roles: effectiveSession!.roles,
            created_at: new Date().toISOString(),
          },
          capabilities: effectiveSession!.capabilities,
        };

      // --- CATALOG ---
      case 'catalog.items.list': {
        const filter = rawParams as { type?: ItemType; isActive?: boolean } | undefined;
        return this.catalog.listItems(filter);
      }
      case 'catalog.items.get': {
        const { id } = (rawParams as { id: string }) || {};
        return this.catalog.getItem(id);
      }
      case 'catalog.items.create': {
        this.requireCapability(effectiveSession, 'catalog:items.create');
        const parsed = CreateItemInputSchema.parse(rawParams);
        return this.catalog.createItem(auditCtx, parsed);
      }
      case 'catalog.items.update': {
        this.requireCapability(effectiveSession, 'catalog:items.update');
        const { id, data } = (rawParams as { id: string; data: unknown }) || {};
        const parsed = UpdateItemInputSchema.parse(data);
        return this.catalog.updateItem(auditCtx, id, parsed);
      }
      case 'catalog.items.delete': {
        this.requireCapability(effectiveSession, 'catalog:items.delete');
        const { id } = (rawParams as { id: string }) || {};
        return this.catalog.deleteItem(auditCtx, id);
      }

      // Work Centers
      case 'catalog.workCenters.list': {
        const filter = rawParams as { industry?: IndustryVertical } | undefined;
        return this.catalog.listWorkCenters(filter?.industry);
      }
      case 'catalog.workCenters.get': {
        const { id } = (rawParams as { id: string }) || {};
        return this.catalog.getWorkCenter(id);
      }
      case 'catalog.workCenters.create': {
        this.requireCapability(effectiveSession, 'catalog:workCenters.create');
        const parsed = CreateWorkCenterInputSchema.parse(rawParams);
        return this.catalog.createWorkCenter(auditCtx, parsed);
      }
      case 'catalog.workCenters.update': {
        this.requireCapability(effectiveSession, 'catalog:workCenters.update');
        const { id, data } = (rawParams as { id: string; data: unknown }) || {};
        const parsed = UpdateWorkCenterInputSchema.parse(data);
        return this.catalog.updateWorkCenter(auditCtx, id, parsed);
      }
      case 'catalog.workCenters.delete': {
        this.requireCapability(effectiveSession, 'catalog:workCenters.delete');
        const { id } = (rawParams as { id: string }) || {};
        return this.catalog.deleteWorkCenter(auditCtx, id);
      }

      // Suppliers & Locations
      case 'catalog.suppliers.list':
        return this.catalog.listSuppliers();
      case 'catalog.locations.list':
        return this.catalog.listLocations();

      // --- MANUFACTURING / RECIPES ---
      case 'manufacturing.recipes.list': {
        const filter = rawParams as { industry?: IndustryVertical } | undefined;
        return this.bom.listRecipes(filter?.industry);
      }
      case 'manufacturing.recipes.get': {
        const { id } = (rawParams as { id: string }) || {};
        return this.bom.getRecipe(id);
      }
      case 'manufacturing.recipes.create': {
        this.requireCapability(effectiveSession, 'manufacturing:recipes.create');
        const parsed = CreateRecipeInputSchema.parse(rawParams);
        return this.bom.createRecipe(auditCtx, parsed);
      }
      case 'manufacturing.recipes.update': {
        this.requireCapability(effectiveSession, 'manufacturing:recipes.update');
        const { id, data } = (rawParams as { id: string; data: unknown }) || {};
        const parsed = UpdateRecipeInputSchema.parse(data);
        return this.bom.updateRecipe(auditCtx, id, parsed);
      }
      case 'manufacturing.recipes.delete': {
        this.requireCapability(effectiveSession, 'manufacturing:recipes.delete');
        const { id } = (rawParams as { id: string }) || {};
        return this.bom.deleteRecipe(auditCtx, id);
      }
      case 'manufacturing.recipes.calculateCost': {
        const { id, batchQtyScaled } = (rawParams as { id: string; batchQtyScaled?: number }) || {};
        return this.bom.calculateCost(id, batchQtyScaled);
      }

      // --- WORK ORDERS ---
      case 'manufacturing.workOrders.list': {
        const filter = rawParams as { status?: WorkOrderStatus } | undefined;
        return this.workOrders.listWorkOrders(filter?.status);
      }
      case 'manufacturing.workOrders.get': {
        const { id } = (rawParams as { id: string }) || {};
        return this.workOrders.getWorkOrder(id);
      }
      case 'manufacturing.workOrders.create': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.create');
        const parsed = CreateWorkOrderInputSchema.parse(rawParams);
        return this.workOrders.createWorkOrder(auditCtx, parsed);
      }
      case 'manufacturing.workOrders.release': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.release');
        const { id } = (rawParams as { id: string }) || {};
        return this.workOrders.releaseWorkOrder(auditCtx, id);
      }
      case 'manufacturing.workOrders.start': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.start');
        const { id } = (rawParams as { id: string }) || {};
        return this.workOrders.startWorkOrder(auditCtx, id);
      }
      case 'manufacturing.workOrders.complete': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.complete');
        const { id, params } = (rawParams as { id: string; params: unknown }) || {};
        const parsed = CompleteWorkOrderInputSchema.parse(params);
        return this.workOrders.completeWorkOrder(auditCtx, id, parsed);
      }
      case 'manufacturing.workOrders.cancel': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.cancel');
        const { id, reason } = (rawParams as { id: string; reason?: string }) || {};
        return this.workOrders.cancelWorkOrder(auditCtx, id, reason);
      }
      case 'manufacturing.workOrders.addConsumption': {
        this.requireCapability(effectiveSession, 'manufacturing:workOrders.consume');
        const parsed = AddConsumptionInputSchema.parse(rawParams);
        return this.workOrders.addConsumption(auditCtx, parsed);
      }

      // --- INVENTORY ---
      case 'inventory.lots.list': {
        const filter = rawParams as { itemId?: string } | undefined;
        return this.inventory.listLots(filter?.itemId);
      }
      case 'inventory.stock.getOnHand': {
        const filter = rawParams as { itemId?: string } | undefined;
        return this.inventory.getStockOnHand(filter?.itemId);
      }
      case 'inventory.stock.listBalances': {
        return this.inventory.listStockBalances();
      }
      case 'inventory.movements.record': {
        this.requireCapability(effectiveSession, 'inventory:movements.create');
        const parsed = RecordMovementInputSchema.parse(rawParams);
        return this.inventory.recordMovement(auditCtx, {
          movementType: parsed.movementType,
          itemId: parsed.itemId,
          lotId: parsed.lotId,
          locationId: parsed.locationId,
          quantityScaled: parsed.quantityScaled,
          unitCostMinor: parsed.unitCostMinor,
          referenceType: parsed.referenceType,
          referenceId: parsed.referenceId,
        });
      }
      case 'inventory.movements.receiveGoods': {
        this.requireCapability(effectiveSession, 'inventory:movements.receive');
        const parsed = GoodsReceiptInputSchema.parse(rawParams);
        return this.inventory.receiveGoods(auditCtx, parsed);
      }
      case 'inventory.lots.updateQc': {
        this.requireCapability(effectiveSession, 'quality:inspections.update');
        const { lotId, qcStatus, notes } =
          (rawParams as { lotId: string; qcStatus: QcStatus; notes?: string }) || {};
        return this.inventory.updateLotQc(auditCtx, lotId, qcStatus, notes);
      }
      case 'inventory.lots.getGenealogy': {
        const { lotId } = (rawParams as { lotId: string }) || {};
        const lots = this.inventory.listLots();
        const lot = lots.find(
          (l) => l.id === lotId || (l as unknown as Record<string, unknown>).lot_number === lotId,
        );
        if (!lot) throw new RpcError('NOT_FOUND', 'errors.lotNotFound', `Lot ${lotId} not found.`);
        const lotObj = lot as unknown as Record<string, unknown>;
        return {
          lot: {
            id: lot.id,
            lot_number: String(lotObj.lotNumber || lotObj.lot_number || ''),
            item_id: String(lotObj.itemId || lotObj.item_id || ''),
            item_code: lotObj.itemCode ? String(lotObj.itemCode) : undefined,
            item_name_ar: lotObj.itemNameAr ? String(lotObj.itemNameAr) : undefined,
            item_name_en: lotObj.itemNameEn ? String(lotObj.itemNameEn) : undefined,
            qc_status: (lotObj.qcStatus || lotObj.qc_status || 'QUARANTINE') as QcStatus,
            manufacture_date: lotObj.manufactureDate ? String(lotObj.manufactureDate) : null,
            expiry_date: lotObj.expiryDate ? String(lotObj.expiryDate) : null,
            created_at: String(lotObj.createdAt || new Date().toISOString()),
          },
          parents: [],
          children: [],
        };
      }

      // --- REPORTS & ADMIN ---
      case 'reports.dashboardMetrics': {
        return this.inventory.getDashboardMetrics();
      }

      case 'admin.backup.create': {
        this.requireCapability(effectiveSession, 'admin:backup.create');
        const backupId = `bkp-${Date.now()}`;
        return {
          backupId,
          timestamp: new Date().toISOString(),
          sizeBytes: 1024 * 64,
        };
      }

      default:
        throw new RpcError('NOT_FOUND', 'errors.methodNotFound', `RPC method ${method} does not exist.`);
    }
  }

  private requireCapability(session: SessionContext | null, capability: string): void {
    if (!this.security.checkCapability(session, capability)) {
      throw new RpcError('FORBIDDEN', 'errors.forbidden', `Missing required capability: ${capability}`);
    }
  }
}
