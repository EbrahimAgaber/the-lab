import { useCallback, useEffect, useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import { LotBadge, StatusChip, type Tone } from '../components/Badges';
import { api, type LotDto, type QcStatus } from '../api/client';

function qcTone(qc: QcStatus): { label: 'qc.quarantine' | 'qc.released' | 'qc.rejected'; tone: Tone } {
  switch (qc) {
    case 'RELEASED':
      return { label: 'qc.released', tone: 'success' };
    case 'REJECTED':
      return { label: 'qc.rejected', tone: 'danger' };
    default:
      return { label: 'qc.quarantine', tone: 'warning' };
  }
}

export function QualityPage() {
  const { t, date, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [lots, setLots] = useState<LotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<QcStatus | 'ALL'>('QUARANTINE');
  const [search, setSearch] = useState('');

  // Disposition Modal state
  const [selectedLot, setSelectedLot] = useState<LotDto | null>(null);
  const [dispositionAction, setDispositionAction] = useState<'RELEASED' | 'REJECTED' | null>(null);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.inventory.listLots();
      setLots(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDisposition = (lot: LotDto, action: 'RELEASED' | 'REJECTED') => {
    setSelectedLot(lot);
    setDispositionAction(action);
    setInspectorNotes('');
  };

  const handleCloseDisposition = () => {
    setSelectedLot(null);
    setDispositionAction(null);
    setInspectorNotes('');
  };

  const handleSubmitDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot || !dispositionAction) return;

    setSubmitting(true);
    try {
      await api.inventory.updateLotQc(selectedLot.id, dispositionAction, inspectorNotes);
      handleCloseDisposition();
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLots = lots.filter((l) => {
    if (filterStatus !== 'ALL' && l.qc_status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.lot_number.toLowerCase().includes(q) ||
      (l.item_code && l.item_code.toLowerCase().includes(q)) ||
      (l.item_name_ar && l.item_name_ar.includes(q)) ||
      (l.item_name_en && l.item_name_en.toLowerCase().includes(q))
    );
  });

  const quarantineCount = lots.filter((l) => l.qc_status === 'QUARANTINE').length;
  const releasedCount = lots.filter((l) => l.qc_status === 'RELEASED').length;
  const rejectedCount = lots.filter((l) => l.qc_status === 'REJECTED').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.quality.title')}</h1>
          <p className="page-sub">{t('page.quality.subtitle')}</p>
        </div>
      </div>

      <section className="card">
        {/* KPI / Tab Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderBlockEnd: '1px solid var(--color-border)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              data-active={filterStatus === 'QUARANTINE'}
              onClick={() => setFilterStatus('QUARANTINE')}
              style={{
                borderColor: filterStatus === 'QUARANTINE' ? 'var(--color-warning)' : undefined,
                background:
                  filterStatus === 'QUARANTINE' ? 'var(--color-warning-soft)' : undefined,
                fontWeight: filterStatus === 'QUARANTINE' ? 600 : undefined,
              }}
            >
              <span>{t('tab.qc.quarantine')}</span>
              <span className="num" style={{ marginInlineStart: 4, fontWeight: 'bold' }}>
                ({quarantineCount})
              </span>
            </button>

            <button
              type="button"
              className="btn"
              data-active={filterStatus === 'RELEASED'}
              onClick={() => setFilterStatus('RELEASED')}
              style={{
                borderColor: filterStatus === 'RELEASED' ? 'var(--color-success)' : undefined,
                background:
                  filterStatus === 'RELEASED' ? 'var(--color-success-soft)' : undefined,
                fontWeight: filterStatus === 'RELEASED' ? 600 : undefined,
              }}
            >
              <span>{t('tab.qc.released')}</span>
              <span className="num" style={{ marginInlineStart: 4, fontWeight: 'bold' }}>
                ({releasedCount})
              </span>
            </button>

            <button
              type="button"
              className="btn"
              data-active={filterStatus === 'REJECTED'}
              onClick={() => setFilterStatus('REJECTED')}
              style={{
                borderColor: filterStatus === 'REJECTED' ? 'var(--color-danger)' : undefined,
                background:
                  filterStatus === 'REJECTED' ? 'var(--color-danger-soft)' : undefined,
                fontWeight: filterStatus === 'REJECTED' ? 600 : undefined,
              }}
            >
              <span>{t('tab.qc.rejected')}</span>
              <span className="num" style={{ marginInlineStart: 4, fontWeight: 'bold' }}>
                ({rejectedCount})
              </span>
            </button>

            <button
              type="button"
              className="btn"
              data-active={filterStatus === 'ALL'}
              onClick={() => setFilterStatus('ALL')}
              style={{
                background: filterStatus === 'ALL' ? 'var(--color-bg-raised)' : undefined,
                fontWeight: filterStatus === 'ALL' ? 600 : undefined,
              }}
            >
              <span>{t('tab.qc.all')}</span>
              <span className="num" style={{ marginInlineStart: 4 }}>
                ({lots.length})
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn" onClick={() => loadData()}>
              {t('action.refresh')}
            </button>
          </div>
        </div>

        {/* Search input bar */}
        <div className="toolbar" style={{ display: 'flex', gap: 12 }}>
          <input
            className="input"
            type="search"
            aria-label={t('page.workOrders.search')}
            placeholder={isRtl ? 'بحث برقم الدفعة أو رمز الصنف...' : 'Search by lot or item code...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Quality Lots Inspection Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('col.lot')}</th>
                <th scope="col">{t('col.item')}</th>
                <th scope="col">{t('field.code')}</th>
                <th scope="col">{t('col.mfgDate')}</th>
                <th scope="col">{t('col.expDate')}</th>
                <th scope="col">{t('col.qc')}</th>
                <th scope="col">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.loading')}
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.empty')}
                  </td>
                </tr>
              ) : (
                filteredLots.map((lot) => {
                  const toneInfo = qcTone(lot.qc_status);
                  const isQuarantine = lot.qc_status === 'QUARANTINE';

                  return (
                    <tr key={lot.id}>
                      <td>
                        <LotBadge code={lot.lot_number} />
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {isRtl ? lot.item_name_ar || lot.item_id : lot.item_name_en || lot.item_id}
                      </td>
                      <td>
                        <bdi className="ltr-code" dir="ltr">
                          {lot.item_code || '—'}
                        </bdi>
                      </td>
                      <td className="num">
                        {lot.manufacture_date ? date(lot.manufacture_date) : '—'}
                      </td>
                      <td className="num">
                        {lot.expiry_date ? date(lot.expiry_date) : '—'}
                      </td>
                      <td>
                        <StatusChip label={toneInfo.label} tone={toneInfo.tone} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          {isQuarantine ? (
                            <>
                              <button
                                type="button"
                                className="btn"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 12,
                                  color: 'var(--color-success)',
                                  borderColor: 'var(--color-success)',
                                  fontWeight: 600,
                                }}
                                onClick={() => handleOpenDisposition(lot, 'RELEASED')}
                              >
                                {t('action.releaseLot')}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 12,
                                  color: 'var(--color-danger)',
                                  borderColor: 'var(--color-danger)',
                                }}
                                onClick={() => handleOpenDisposition(lot, 'REJECTED')}
                              >
                                {t('action.rejectLot')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() =>
                                handleOpenDisposition(
                                  lot,
                                  lot.qc_status === 'RELEASED' ? 'REJECTED' : 'RELEASED',
                                )
                              }
                            >
                              {lot.qc_status === 'RELEASED'
                                ? t('action.rejectLot')
                                : t('action.releaseLot')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* QC Disposition Inspector Notes Modal */}
      {selectedLot && dispositionAction && (
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
              maxInlineSize: 520,
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                {dispositionAction === 'RELEASED'
                  ? t('dialog.qc.releaseTitle')
                  : t('dialog.qc.rejectTitle')}
              </h2>
              <p
                style={{
                  margin: 'var(--space-1) 0 0',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {t('col.lot')}:{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {selectedLot.lot_number}
                </strong>{' '}
                —{' '}
                {isRtl
                  ? selectedLot.item_name_ar || selectedLot.item_id
                  : selectedLot.item_name_en || selectedLot.item_id}
              </p>
            </div>

            <form onSubmit={handleSubmitDisposition}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <label
                    htmlFor="qc-inspector-notes"
                    style={{
                      display: 'block',
                      marginBottom: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                    }}
                  >
                    {t('dialog.qc.notesLabel')}
                  </label>
                  <textarea
                    id="qc-inspector-notes"
                    className="input"
                    rows={4}
                    style={{
                      inlineSize: '100%',
                      blockSize: 'auto',
                      minBlockSize: 90,
                      padding: 'var(--space-2)',
                    }}
                    placeholder={
                      dispositionAction === 'RELEASED'
                        ? isRtl
                          ? 'مطابقة المعايير الفيزيائية والكيميائية، جاهز للإفراج...'
                          : 'Conforms to microbiological and physical standards. Approved...'
                        : isRtl
                          ? 'عدم مطابقة درجات اللزوجة أو التلوث، توجيه للحجر والإتلاف...'
                          : 'Failed viscosity or contamination inspection. Diverted to quarantine scrap...'
                    }
                    value={inspectorNotes}
                    onChange={(e) => setInspectorNotes(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  <button
                    type="button"
                    className="btn"
                    onClick={handleCloseDisposition}
                    disabled={submitting}
                  >
                    {t('dialog.cancel')}
                  </button>

                  <button
                    type="submit"
                    className="btn"
                    disabled={submitting}
                    style={{
                      background:
                        dispositionAction === 'RELEASED'
                          ? 'var(--color-success)'
                          : 'var(--color-danger)',
                      color: '#fff',
                      borderColor: 'transparent',
                      fontWeight: 600,
                    }}
                  >
                    {dispositionAction === 'RELEASED'
                      ? t('dialog.qc.confirmRelease')
                      : t('dialog.qc.confirmReject')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
