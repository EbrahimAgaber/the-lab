import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, setSessionToken, getSessionToken } from '../src/api/client';
import { RpcError } from '@the-lab/contract';

interface CustomElectronWindow {
  labRpc?: {
    invoke: (method: string, params: unknown, token?: string | null) => Promise<{ result?: unknown; error?: unknown }>;
  };
}

describe('LabApiClient Typed RPC Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSessionToken(null);
  });

  it('manages session tokens correctly in memory and localStorage', () => {
    expect(getSessionToken()).toBeNull();
    setSessionToken('token-abc-123');
    expect(getSessionToken()).toBe('token-abc-123');
    setSessionToken(null);
    expect(getSessionToken()).toBeNull();
  });

  it('invokes RPC via fetch when window.labRpc is undefined', async () => {
    const mockItems = [
      {
        id: 'itm-1',
        code: 'RAW-01',
        name_ar: 'مادة خام',
        name_en: 'Raw Material',
        type: 'RAW' as const,
        uom_code: 'KG',
        cost_minor: 100,
        reorder_point_scaled: 0,
        is_active: true,
        created_at: '2026-10-14T00:00:00Z',
        updated_at: '2026-10-14T00:00:00Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ result: mockItems }),
    } as Response);

    const items = await api.items.list();
    expect(items).toEqual(mockItems);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/rpc',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ method: 'catalog.items.list', params: undefined }),
      }),
    );
  });

  it('routes through window.labRpc in Electron desktop mode', async () => {
    const mockWorkOrders = [
      {
        id: 'wo-1',
        order_number: 'WO-00001',
        item_id: 'itm-1',
        planned_quantity_scaled: 10000,
        yield_quantity_scaled: 0,
        scrap_quantity_scaled: 0,
        status: 'DRAFT' as const,
        qc_status: 'QUARANTINE',
        due_date: '2026-10-20',
        notes: null,
        created_at: '2026-10-14T00:00:00Z',
        updated_at: '2026-10-14T00:00:00Z',
      },
    ];

    const invokeMock = vi.fn().mockResolvedValue({ result: mockWorkOrders });
    const win = window as unknown as CustomElectronWindow;
    win.labRpc = { invoke: invokeMock };

    const orders = await api.workOrders.list('DRAFT');
    expect(orders).toEqual(mockWorkOrders);
    expect(invokeMock).toHaveBeenCalledWith('manufacturing.workOrders.list', { status: 'DRAFT' }, 'bootstrap-admin');

    delete win.labRpc;
  });

  it('throws typed RpcError when response contains an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({
        error: {
          code: 'INSUFFICIENT_STOCK',
          messageKey: 'errors.insufficientStock',
          message: 'Not enough raw material in lot',
        },
      }),
    } as Response);

    await expect(
      api.inventory.recordMovement({
        movementType: 'ISSUE',
        itemId: 'itm-1',
        lotId: 'lot-1',
        locationId: 'loc-1',
        quantityScaled: -50000,
      }),
    ).rejects.toThrow(RpcError);
  });

  it('supports admin setup state queries and login lifecycle', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        json: async () => ({
          result: { isSetupComplete: true, companyNameAr: 'المعمل الذكي' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          result: {
            token: 'session-xyz',
            user: { id: 'usr-1', username: 'admin', display_name: 'Admin', roles: ['ADMIN'] },
            capabilities: ['*:*.*'],
          },
        }),
      } as Response);

    const setupState = await api.admin.getSetupState();
    expect(setupState.isSetupComplete).toBe(true);

    const loginRes = await api.auth.login({ username: 'admin', password: 'secretpassword' });
    expect(loginRes.token).toBe('session-xyz');
    expect(getSessionToken()).toBe('session-xyz');
  });
});
