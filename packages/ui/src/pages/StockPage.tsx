import { useCallback, useEffect, useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import { LotBadge, StatusChip, type Tone } from '../components/Badges';
import {
  api,
  type StockBalanceRow,
  type ItemDto,
  type GoodsReceiptDto,
} from '../api/client';

function qcTone(qc: string): { label: 'qc.quarantine' | 'qc.released' | 'qc.rejected'; tone: Tone } {
  switch (qc) {
    case 'RELEASED':
      return { label: 'qc.released', tone: 'success' };
    case 'REJECTED':
      return { label: 'qc.rejected', tone: 'danger' };
    default:
      return { label: 'qc.quarantine', tone: 'warning' };
  }
}

export function StockPage() {
  const { t, num, money, date, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [items, setItems] = useState<ItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');

  // Goods Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState<GoodsReceiptDto>({
    itemId: '',
    lotNumber: '',
    locationId: 'loc-raw-main',
    quantityScaled: 10000000, // 1,000 units
    unitCostMinor: 250, // 2.50 SAR
    manufactureDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    qcStatus: 'QUARANTINE',
  });
  const [savingReceipt, setSavingReceipt] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balData, itemsData] = await Promise.all([
        api.inventory.listStockBalances(),
        api.items.list(),
      ]);
      setBalances(balData);
      setItems(itemsData);
      if (itemsData.length > 0 && !receiptForm.itemId) {
        setReceiptForm((prev) => ({
          ...prev,
          itemId: itemsData[0]?.id ?? '',
          unitCostMinor: itemsData[0]?.cost_minor ?? 250,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [receiptForm.itemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenReceipt = () => {
    const nextLotNum = `LT-RCV-${Date.now().toString().slice(-6)}`;
    setReceiptForm({
      itemId: items[0]?.id ?? '',
      lotNumber: nextLotNum,
      locationId: 'loc-raw-main',
      quantityScaled: 10000000,
      unitCostMinor: items[0]?.cost_minor ?? 250,
      manufactureDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      qcStatus: 'QUARANTINE',
    });
    setShowReceiptModal(true);
  };

  const handleItemSelect = (itemId: string) => {
    const sel = items.find((i) => i.id === itemId);
    setReceiptForm((prev) => ({
      ...prev,
      itemId,
      unitCostMinor: sel?.cost_minor ?? prev.unitCostMinor,
    }));
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.itemId || !receiptForm.lotNumber) return;

    setSavingReceipt(true);
    try {
      await api.inventory.receiveGoods(receiptForm);
      setShowReceiptModal(false);
      await loadData();
    } finally {
      setSavingReceipt(false);
    }
  };

  const filteredBalances = balances.filter((b) => {
    if (locationFilter !== 'ALL' && b.locationId !== locationFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.itemCode.toLowerCase().includes(q) ||
      b.lotNumber.toLowerCase().includes(q) ||
      b.itemNameAr.includes(q) ||
      b.itemNameEn.toLowerCase().includes(q) ||
      b.locationNameAr.includes(q) ||
      b.locationNameEn.toLowerCase().includes(q)
    );
  });

  const totalValuation = filteredBalances.reduce((sum, b) => sum + b.totalValueMinor, 0);

  const locations = [
    { id: 'loc-raw-main', label: 'loc.warehouse' as const },
    { id: 'loc-cold-room', label: 'loc.coldRoom' as const },
    { id: 'loc-prod-line-1', label: 'loc.production' as const },
    { id: 'loc-scrap-bay', label: 'loc.scrap' as const },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.stock.title')}</h1>
          <p className="page-sub">{t('page.stock.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={handleOpenReceipt}
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            borderColor: 'transparent',
            fontWeight: 600,
          }}
        >
          {t('action.goodsReceipt')}
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {t('col.totalValue')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              margin: 'var(--space-1) 0',
            }}
          >
            {money(totalValuation)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {filteredBalances.length} {isRtl ? 'سجل دفعة / موقع' : 'ledger rows'}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {t('tab.qc.quarantine')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--color-warning)',
              margin: 'var(--space-1) 0',
            }}
          >
            {balances.filter((b) => b.qcStatus === 'QUARANTINE').length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {isRtl ? 'دفعات تخضع للفحص والاعتماد' : 'Lots under inspection'}
          </div>
        </div>
      </div>

      <section className="card">
        {/* Filters and search bar */}
        <div
          className="toolbar"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <input
              className="input"
              type="search"
              aria-label={t('page.workOrders.search')}
              placeholder={isRtl ? 'بحث بالصنف، الدفعة، أو الموقع...' : 'Search item, lot, location...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="ALL">{isRtl ? 'كافة المواقع والمستودعات' : 'All Storage Locations'}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {t(loc.label)}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn" onClick={() => loadData()}>
            {t('action.refresh')}
          </button>
        </div>

        {/* Real-time Ledger Breakdown Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('col.item')}</th>
                <th scope="col">{t('field.code')}</th>
                <th scope="col">{t('col.lot')}</th>
                <th scope="col">{t('col.location')}</th>
                <th scope="col" className="col-num">
                  {t('col.qty')}
                </th>
                <th scope="col" className="col-num">
                  {t('col.unitCost')}
                </th>
                <th scope="col" className="col-num">
                  {t('col.totalValue')}
                </th>
                <th scope="col">{t('col.expDate')}</th>
                <th scope="col">{t('col.qc')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.loading')}
                  </td>
                </tr>
              ) : filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.empty')}
                  </td>
                </tr>
              ) : (
                filteredBalances.map((row) => {
                  const qtyUnits = row.quantityScaled / 10000;
                  const toneInfo = qcTone(row.qcStatus);

                  return (
                    <tr key={`${row.itemId}-${row.lotId}-${row.locationId}`}>
                      <td style={{ fontWeight: 500 }}>
                        {isRtl ? row.itemNameAr : row.itemNameEn}
                      </td>
                      <td>
                        <bdi className="ltr-code" dir="ltr">
                          {row.itemCode}
                        </bdi>
                      </td>
                      <td>
                        <LotBadge code={row.lotNumber} />
                      </td>
                      <td>
                        <span>{isRtl ? row.locationNameAr : row.locationNameEn}</span>
                      </td>
                      <td className="col-num num">
                        {num(qtyUnits, 2)} {row.uomCode}
                      </td>
                      <td className="col-num num">{money(row.unitCostMinor)}</td>
                      <td className="col-num num" style={{ fontWeight: 600 }}>
                        {money(row.totalValueMinor)}
                      </td>
                      <td className="num">{row.expiryDate ? date(row.expiryDate) : '—'}</td>
                      <td>
                        <StatusChip label={toneInfo.label} tone={toneInfo.tone} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Goods Receipt Modal */}
      {showReceiptModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              inlineSize: '100%',
              maxInlineSize: 580,
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                {t('dialog.receipt.title')}
              </h2>
              <p
                style={{
                  margin: 'var(--space-1) 0 0',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {isRtl
                  ? 'تسجيل شحنة مواد خام وتوليد رقم دفعة مع التقييم المالي'
                  : 'Receive incoming raw materials, assign batch lot and update inventory ledger'}
              </p>
            </div>

            <form onSubmit={handleSaveReceipt}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    htmlFor="receipt-item-select"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.item')}
                  </label>
                  <select
                    id="receipt-item-select"
                    className="select"
                    style={{ inlineSize: '100%' }}
                    value={receiptForm.itemId}
                    onChange={(e) => handleItemSelect(e.target.value)}
                    required
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} — {isRtl ? it.name_ar : it.name_en} ({it.uom_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="receipt-lot-input"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.lotNumber')}
                  </label>
                  <input
                    id="receipt-lot-input"
                    className="input"
                    style={{ inlineSize: '100%', fontFamily: 'var(--font-mono)' }}
                    value={receiptForm.lotNumber}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({ ...prev, lotNumber: e.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="receipt-location-select"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.location')}
                  </label>
                  <select
                    id="receipt-location-select"
                    className="select"
                    style={{ inlineSize: '100%' }}
                    value={receiptForm.locationId}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({ ...prev, locationId: e.target.value }))
                    }
                  >
                    <option value="loc-raw-main">{t('loc.warehouse')}</option>
                    <option value="loc-cold-room">{t('loc.coldRoom')}</option>
                    <option value="loc-prod-line-1">{t('loc.production')}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="receipt-quantity-input"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.quantity')}
                  </label>
                  <input
                    id="receipt-quantity-input"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    style={{ inlineSize: '100%' }}
                    value={receiptForm.quantityScaled / 10000}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({
                        ...prev,
                        quantityScaled: Math.round(Number(e.target.value) * 10000),
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="receipt-cost-input"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.unitCost')}
                  </label>
                  <input
                    id="receipt-cost-input"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    style={{ inlineSize: '100%' }}
                    value={(receiptForm.unitCostMinor / 100).toFixed(2)}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({
                        ...prev,
                        unitCostMinor: Math.round(Number(e.target.value) * 100),
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="receipt-mfg-input"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.mfgDate')}
                  </label>
                  <input
                    id="receipt-mfg-input"
                    className="input"
                    type="date"
                    style={{ inlineSize: '100%' }}
                    value={receiptForm.manufactureDate ?? ''}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({ ...prev, manufactureDate: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="receipt-exp-input"
                    style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 4 }}
                  >
                    {t('dialog.receipt.expDate')}
                  </label>
                  <input
                    id="receipt-exp-input"
                    className="input"
                    type="date"
                    style={{ inlineSize: '100%' }}
                    value={receiptForm.expiryDate ?? ''}
                    onChange={(e) =>
                      setReceiptForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-5)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowReceiptModal(false)}
                  disabled={savingReceipt}
                >
                  {t('dialog.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={savingReceipt}
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderColor: 'transparent',
                    fontWeight: 600,
                  }}
                >
                  {t('dialog.receipt.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
