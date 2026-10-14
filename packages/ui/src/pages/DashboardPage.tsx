import { useEffect, useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import {
  api,
  type DashboardMetricsDto,
  type WorkOrderRow,
  type StockBalanceRow,
} from '../api/client';
import { LotBadge, StatusChip, type Tone } from '../components/Badges';

function woTone(s: string): { label: 'status.draft' | 'status.released' | 'status.inProgress' | 'status.completed'; tone: Tone } {
  switch (s) {
    case 'RELEASED':
      return { label: 'status.released', tone: 'info' };
    case 'IN_PROGRESS':
      return { label: 'status.inProgress', tone: 'warning' };
    case 'COMPLETED':
      return { label: 'status.completed', tone: 'success' };
    default:
      return { label: 'status.draft', tone: 'neutral' };
  }
}

export function DashboardPage() {
  const { t, num, money, date, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [activeOrders, setActiveOrders] = useState<WorkOrderRow[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [m, orders, balances] = await Promise.all([
          api.inventory.getDashboardMetrics(),
          api.workOrders.list(),
          api.inventory.listStockBalances(),
        ]);
        setMetrics(m);
        setActiveOrders(
          orders.filter((o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS'),
        );
        setStockBalances(balances);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !metrics) {
    return <div className="card placeholder">{t('msg.loading')}</div>;
  }

  // Calculate location-wise stock valuation summary
  const locationSummaryMap = new Map<string, { nameAr: string; nameEn: string; totalValuation: number }>();
  for (const b of stockBalances) {
    const existing = locationSummaryMap.get(b.locationId);
    if (existing) {
      existing.totalValuation += b.totalValueMinor;
    } else {
      locationSummaryMap.set(b.locationId, {
        nameAr: b.locationNameAr,
        nameEn: b.locationNameEn,
        totalValuation: b.totalValueMinor,
      });
    }
  }
  const locationAllocations = Array.from(locationSummaryMap.values());

  const isFavorable = metrics.costVarianceMinor <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.dashboard.title')}</h1>
          <p className="page-sub">{t('page.dashboard.subtitle')}</p>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* KPI 1: Total Inventory Valuation */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {t('kpi.inventoryValuation')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              color: 'var(--color-accent)',
              margin: 'var(--space-2) 0',
            }}
          >
            {money(metrics.totalValuationMinor)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {stockBalances.length} {isRtl ? 'دفعة تخزينية بالمستودعات' : 'active inventory lots'}
          </div>
        </div>

        {/* KPI 2: Active Work Orders WIP */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {t('kpi.activeWip')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              margin: 'var(--space-2) 0',
            }}
          >
            {money(metrics.activeWorkOrdersWipMinor)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span className="num" style={{ fontWeight: 600 }}>
              {metrics.activeWorkOrdersCount}
            </span>{' '}
            {t('kpi.activeWipSub')}
          </div>
        </div>

        {/* KPI 3: Monthly Production Yield % */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {t('kpi.yieldPct')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              color: metrics.monthlyProductionYieldPct >= 95 ? '#059669' : '#b26a00',
              margin: 'var(--space-2) 0',
            }}
          >
            {num(metrics.monthlyProductionYieldPct, 1)}%
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {t('kpi.yieldBenchmark')}
          </div>
        </div>

        {/* KPI 4: Cost Variance (Standard vs Actual) */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {t('kpi.costVariance')}
          </div>
          <div
            className="num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              color: isFavorable ? '#059669' : '#c62f2f',
              margin: 'var(--space-2) 0',
            }}
          >
            {isFavorable ? '-' : '+'}
            {money(Math.abs(metrics.costVarianceMinor))}
          </div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: isFavorable ? '#059669' : '#c62f2f',
            }}
          >
            {isFavorable ? t('kpi.favorable') : t('kpi.unfavorable')}
          </div>
        </div>
      </div>

      {/* Variance Analysis Deep-Dive & Strategic Stock Allocation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 'var(--space-4)',
        }}
      >
        {/* Cost Variance Analysis Table */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ marginBlockEnd: 'var(--space-3)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
              {t('card.costVarianceAnalysis')}
            </h2>
            <p
              style={{
                margin: 'var(--space-1) 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              {isRtl
                ? 'مقارنة التكاليف المعيارية المحسوبة في استوديو الوصفات بالتكاليف الفعلية المسجلة بسجلات التصنيع'
                : 'Direct comparison between Recipe BOM standard costs and actual execution expenses'}
            </p>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('col.costCategory')}</th>
                  <th scope="col" className="col-num">
                    {t('col.standardCost')}
                  </th>
                  <th scope="col" className="col-num">
                    {t('col.actualCost')}
                  </th>
                  <th scope="col" className="col-num">
                    {t('col.variance')}
                  </th>
                  <th scope="col" className="col-num">
                    {t('col.variancePct')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.varianceBreakdown.map((row) => {
                  const isRowFavorable = row.varianceMinor <= 0;
                  const varPct =
                    row.standardMinor > 0
                      ? ((row.varianceMinor / row.standardMinor) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr key={row.category}>
                      <td style={{ fontWeight: 600 }}>
                        {isRtl ? row.categoryAr : row.categoryEn}
                      </td>
                      <td className="col-num num">{money(row.standardMinor)}</td>
                      <td className="col-num num">{money(row.actualMinor)}</td>
                      <td
                        className="col-num num"
                        style={{
                          fontWeight: 700,
                          color: isRowFavorable ? '#059669' : '#c62f2f',
                        }}
                      >
                        {isRowFavorable ? '' : '+'}
                        {money(row.varianceMinor)}
                      </td>
                      <td
                        className="col-num num"
                        style={{
                          fontWeight: 600,
                          color: isRowFavorable ? '#059669' : '#c62f2f',
                        }}
                      >
                        {isRowFavorable ? '' : '+'}
                        {varPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Split: Active Production Orders & Location Allocation */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {/* Active Work Orders WIP */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-md)' }}>
              {t('card.wipProgress')}
            </h3>
            {activeOrders.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                {t('msg.empty')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activeOrders.map((wo) => {
                  const toneInfo = woTone(wo.status);
                  const progress = wo.status === 'IN_PROGRESS' ? 65 : 20;

                  return (
                    <div
                      key={wo.id}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-raised)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <bdi className="ltr-code" dir="ltr" style={{ fontWeight: 600 }}>
                          {wo.order_number}
                        </bdi>
                        <StatusChip label={toneInfo.label} tone={toneInfo.tone} />
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>
                        {wo.item_name || wo.item_id}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <span>
                          {t('col.lot')}: <LotBadge code={wo.lot_number || 'LT-PENDING'} />
                        </span>
                        <span>
                          {t('col.due')}: <span className="num">{date(wo.due_date)}</span>
                        </span>
                      </div>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ inlineSize: '100%' }}
                      >
                        <span style={{ inlineSize: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Strategic Stock Allocation by Location */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-md)' }}>
              {t('card.stockAllocation')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {locationAllocations.map((loc) => {
                const totalMinor = metrics.totalValuationMinor || 1;
                const pct = Math.round((loc.totalValuation / totalMinor) * 100);

                return (
                  <div key={loc.nameEn} style={{ fontSize: 'var(--text-sm)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        {isRtl ? loc.nameAr : loc.nameEn}
                      </span>
                      <span className="num" style={{ fontWeight: 600 }}>
                        {money(loc.totalValuation)} ({pct}%)
                      </span>
                    </div>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ inlineSize: '100%', blockSize: 8 }}
                    >
                      <span style={{ inlineSize: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
