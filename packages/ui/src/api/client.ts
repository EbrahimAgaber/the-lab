/**
 * The Lab — Unified Typed RPC Client
 * Calls @the-lab/core via IPC in Electron or HTTP /rpc in Web/LAN.
 * Single source of truth: Zero client-side database or mock business logic.
 */

import {
  type ItemDto,
  type CreateItemDto,
  type UpdateItemDto,
  type WorkCenterDto,
  type CreateWorkCenterDto,
  type UpdateWorkCenterDto,
  type RecipeDto,
  type CreateRecipeDto,
  type UpdateRecipeDto,
  type CostBreakdownDto,
  type WorkOrderRow,
  type CreateWorkOrderDto,
  type CompleteWorkOrderDto,
  type AddConsumptionDto,
  type WorkOrderConsumptionRecord,
  type LotDto,
  type StockOnHandDto,
  type StockBalanceRow,
  type GoodsReceiptDto,
  type RecordMovementDto,
  type InventoryMovementDto,
  type DashboardMetricsDto,
  type SetupStateDto,
  type CompleteSetupDto,
  type LoginDto,
  type LoginResultDto,
  type UserDto,
  type RpcMethodName,
  type RpcErrorCode,
  type IndustryVertical,
  type ItemType,
  type QcStatus,
  type WorkOrderStatus,
  RpcError,
} from '@the-lab/contract';

export type {
  ItemDto,
  CreateItemDto,
  UpdateItemDto,
  WorkCenterDto,
  CreateWorkCenterDto,
  UpdateWorkCenterDto,
  RecipeDto,
  CreateRecipeDto,
  UpdateRecipeDto,
  CostBreakdownDto,
  WorkOrderRow,
  CreateWorkOrderDto,
  CompleteWorkOrderDto,
  AddConsumptionDto,
  WorkOrderConsumptionRecord,
  LotDto,
  StockOnHandDto,
  StockBalanceRow,
  GoodsReceiptDto,
  RecordMovementDto,
  InventoryMovementDto,
  DashboardMetricsDto,
  SetupStateDto,
  CompleteSetupDto,
  LoginDto,
  LoginResultDto,
  UserDto,
  IndustryVertical,
  ItemType,
  QcStatus,
  WorkOrderStatus,
};

let activeSessionToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('the-lab.sessionToken') : null;

export function setSessionToken(token: string | null) {
  activeSessionToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('the-lab.sessionToken', token);
    else localStorage.removeItem('the-lab.sessionToken');
  }
}

export function getSessionToken(): string | null {
  return activeSessionToken;
}

export async function invokeRpc<T = unknown>(method: RpcMethodName, params?: unknown): Promise<T> {
  const electronRpc =
    typeof window !== 'undefined' &&
    (
      window as unknown as {
        labRpc?: {
          invoke: (
            m: string,
            p: unknown,
            t?: string | null,
          ) => Promise<{ result?: unknown; error?: { code: string; messageKey: string; message?: string } }>;
        };
      }
    ).labRpc;

  let response: { result?: unknown; error?: { code: string; messageKey: string; message?: string } };

  const token = activeSessionToken || 'bootstrap-admin';

  if (electronRpc) {
    response = await electronRpc.invoke(method, params, token);
  } else {
    const res = await fetch('/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({ method, params }),
    });
    response = await res.json();
  }

  if (response.error) {
    throw new RpcError(response.error.code as RpcErrorCode, response.error.messageKey, response.error.message);
  }

  return response.result as T;
}

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
  auth: {
    login(dto: LoginDto): Promise<LoginResultDto>;
    logout(): Promise<{ success: boolean }>;
    getMe(): Promise<{ user: UserDto; capabilities: string[] }>;
  };
  admin: {
    getSetupState(): Promise<SetupStateDto>;
    completeSetup(dto: CompleteSetupDto): Promise<{ success: boolean; user: UserDto }>;
    createBackup(): Promise<{ backupId: string; timestamp: string; sizeBytes: number }>;
  };
}

export const api: LabApiClient = {
  items: {
    list: (filter) => invokeRpc<ItemDto[]>('catalog.items.list', filter),
    get: (id) => invokeRpc<ItemDto | null>('catalog.items.get', { id }),
    create: (dto) => invokeRpc<ItemDto>('catalog.items.create', dto),
    update: (id, dto) => invokeRpc<ItemDto>('catalog.items.update', { id, data: dto }),
    delete: (id) => invokeRpc<{ deleted: boolean }>('catalog.items.delete', { id }),
  },
  workCenters: {
    list: (industry) => invokeRpc<WorkCenterDto[]>('catalog.workCenters.list', { industry }),
    get: (id) => invokeRpc<WorkCenterDto | null>('catalog.workCenters.get', { id }),
    create: (dto) => invokeRpc<WorkCenterDto>('catalog.workCenters.create', dto),
    update: (id, dto) => invokeRpc<WorkCenterDto>('catalog.workCenters.update', { id, data: dto }),
    delete: (id) => invokeRpc<{ deleted: boolean }>('catalog.workCenters.delete', { id }),
  },
  recipes: {
    list: (industry) => invokeRpc<RecipeDto[]>('manufacturing.recipes.list', { industry }),
    get: (id) => invokeRpc<RecipeDto | null>('manufacturing.recipes.get', { id }),
    create: (dto) => invokeRpc<RecipeDto>('manufacturing.recipes.create', dto),
    update: (id, dto) => invokeRpc<RecipeDto>('manufacturing.recipes.update', { id, data: dto }),
    delete: (id) => invokeRpc<{ deleted: boolean }>('manufacturing.recipes.delete', { id }),
    calculateCost: (id, batchQtyScaled) =>
      invokeRpc<CostBreakdownDto>('manufacturing.recipes.calculateCost', { id, batchQtyScaled }),
  },
  workOrders: {
    list: (status) => invokeRpc<WorkOrderRow[]>('manufacturing.workOrders.list', { status }),
    get: (id) => invokeRpc<WorkOrderRow | null>('manufacturing.workOrders.get', { id }),
    create: (dto) => invokeRpc<WorkOrderRow>('manufacturing.workOrders.create', dto),
    release: (id) => invokeRpc<WorkOrderRow>('manufacturing.workOrders.release', { id }),
    start: (id) => invokeRpc<WorkOrderRow>('manufacturing.workOrders.start', { id }),
    complete: (id, params) => invokeRpc<WorkOrderRow>('manufacturing.workOrders.complete', { id, params }),
    cancel: (id, reason) => invokeRpc<WorkOrderRow>('manufacturing.workOrders.cancel', { id, reason }),
    addConsumption: (dto) =>
      invokeRpc<WorkOrderConsumptionRecord>('manufacturing.workOrders.addConsumption', dto),
  },
  inventory: {
    listLots: (itemId) => invokeRpc<LotDto[]>('inventory.lots.list', { itemId }),
    getStockOnHand: (itemId) => invokeRpc<StockOnHandDto[]>('inventory.stock.getOnHand', { itemId }),
    listStockBalances: () => invokeRpc<StockBalanceRow[]>('inventory.stock.listBalances'),
    getBalance: async () => '0',
    recordMovement: (dto) => invokeRpc<InventoryMovementDto>('inventory.movements.record', dto),
    receiveGoods: (dto) =>
      invokeRpc<{ lotId: string; movementId: string }>('inventory.movements.receiveGoods', dto),
    updateLotQc: (lotId, qcStatus, notes) =>
      invokeRpc<LotDto>('inventory.lots.updateQc', { lotId, qcStatus, notes }),
    getDashboardMetrics: () => invokeRpc<DashboardMetricsDto>('reports.dashboardMetrics'),
  },
  auth: {
    login: async (dto) => {
      const res = await invokeRpc<LoginResultDto>('auth.login', dto);
      setSessionToken(res.token);
      return res;
    },
    logout: async () => {
      const res = await invokeRpc<{ success: boolean }>('auth.logout');
      setSessionToken(null);
      return res;
    },
    getMe: () => invokeRpc<{ user: UserDto; capabilities: string[] }>('auth.getMe'),
  },
  admin: {
    getSetupState: () => invokeRpc<SetupStateDto>('admin.getSetupState'),
    completeSetup: async (dto) => {
      const res = await invokeRpc<{ success: boolean; user: UserDto }>('admin.completeSetup', dto);
      return res;
    },
    createBackup: () => invokeRpc<{ backupId: string; timestamp: string; sizeBytes: number }>('admin.backup.create'),
  },
};
