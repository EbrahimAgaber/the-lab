import { useCallback, useEffect, useState, useId } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';
import { LotBadge, StatusChip, type Tone } from '../components/Badges';
import { ChevronBack, ChevronForward, IconFactory } from '../components/icons';
import {
  api,
  type WorkOrderRow,
  type WorkOrderStatus,
  type ItemDto,
  type RecipeDto,
} from '../api/client';

const STEPS: { status: WorkOrderStatus; label: MessageKey }[] = [
  { status: 'DRAFT', label: 'status.draft' },
  { status: 'RELEASED', label: 'status.released' },
  { status: 'IN_PROGRESS', label: 'status.inProgress' },
  { status: 'COMPLETED', label: 'status.completed' },
];

function statusTone(s: WorkOrderStatus): { label: MessageKey; tone: Tone } {
  switch (s) {
    case 'DRAFT':
      return { label: 'status.draft', tone: 'neutral' };
    case 'RELEASED':
      return { label: 'status.released', tone: 'info' };
    case 'IN_PROGRESS':
      return { label: 'status.inProgress', tone: 'warning' };
    case 'COMPLETED':
      return { label: 'status.completed', tone: 'success' };
    case 'CANCELLED':
      return { label: 'status.cancelled' as MessageKey, tone: 'danger' };
    default:
      return { label: 'status.draft', tone: 'neutral' };
  }
}

function qcTone(qc: string): { label: MessageKey; tone: Tone } {
  switch (qc) {
    case 'RELEASED':
      return { label: 'qc.released', tone: 'success' };
    case 'REJECTED':
      return { label: 'qc.rejected', tone: 'danger' };
    default:
      return { label: 'qc.quarantine', tone: 'warning' };
  }
}

export function WorkOrdersPage() {
  const { t, money, num, date, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [items, setItems] = useState<ItemDto[]>([]);
  const [recipes, setRecipes] = useState<RecipeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<WorkOrderStatus | 'ALL'>('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [activeWo, setActiveWo] = useState<WorkOrderRow | null>(null);

  // New Work Order Form State
  const [formOrderNumber, setFormOrderNumber] = useState('');
  const [formRecipeId, setFormRecipeId] = useState('');
  const [formItemId, setFormItemId] = useState('');
  const [formQtyUnits, setFormQtyUnits] = useState('1000');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Complete WO Form State (Yield & Scrap logging)
  const [completeYieldUnits, setCompleteYieldUnits] = useState('');
  const [completeScrapUnits, setCompleteScrapUnits] = useState('0');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeError, setCompleteError] = useState('');

  // Cancel WO Form State
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const searchInputId = useId();
  const orderNumberInputId = useId();
  const recipeSelectId = useId();
  const itemSelectId = useId();
  const plannedQtyInputId = useId();
  const dueDateInputId = useId();
  const notesTextareaId = useId();
  const actualYieldInputId = useId();
  const actualScrapInputId = useId();
  const completeNotesInputId = useId();
  const cancelReasonInputId = useId();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [woData, itemsData, recipesData] = await Promise.all([
        api.workOrders.list(selectedStatus === 'ALL' ? undefined : selectedStatus),
        api.items.list(),
        api.recipes.list(),
      ]);
      setRows(woData);
      setItems(itemsData);
      setRecipes(recipesData);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle recipe selection in New WO modal to auto-populate finished item & default batch
  const handleRecipeChange = (recId: string) => {
    setFormRecipeId(recId);
    const selectedRec = recipes.find((r) => r.id === recId);
    if (selectedRec) {
      setFormItemId(selectedRec.output_item_id);
      setFormQtyUnits((selectedRec.base_quantity_scaled / 10000).toString());
      if (!formNotes) {
        setFormNotes(
          isRtl
            ? `ØªØ´ØºÙŠÙ„ Ø£Ù…Ø± Ø¥Ù†ØªØ§Ø¬ ÙˆÙÙ‚ Ø§Ù„ÙˆØµÙØ© Ø§Ù„Ù…Ø¹ÙŠØ§Ø±ÙŠØ© ${selectedRec.code} (${selectedRec.name_ar})`
            : `Production run under standard formula ${selectedRec.code} (${selectedRec.name_en})`,
        );
      }
    }
  };

  const openNewWorkOrderModal = () => {
    const defaultNum = `WO-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    setFormOrderNumber(defaultNum);

    const defaultRecipe = recipes[0];
    if (defaultRecipe) {
      setFormRecipeId(defaultRecipe.id);
      setFormItemId(defaultRecipe.output_item_id);
      setFormQtyUnits((defaultRecipe.base_quantity_scaled / 10000).toString());
      setFormNotes(
        isRtl
          ? `ØªØ´ØºÙŠÙ„ Ø£Ù…Ø± Ø¥Ù†ØªØ§Ø¬ ÙˆÙÙ‚ Ø§Ù„ÙˆØµÙØ© Ø§Ù„Ù…Ø¹ÙŠØ§Ø±ÙŠØ© ${defaultRecipe.code} (${defaultRecipe.name_ar})`
          : `Production run under standard formula ${defaultRecipe.code} (${defaultRecipe.name_en})`,
      );
    } else {
      setFormRecipeId('');
      setFormItemId(items[0]?.id || '');
      setFormQtyUnits('1000');
      setFormNotes('');
    }

    // Default due date: 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setFormDueDate(d.toISOString().slice(0, 10));

    setCreateError('');
    setCreateModalOpen(true);
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrderNumber.trim() || !formItemId || !formDueDate) {
      setCreateError(isRtl ? 'ÙŠØ±Ø¬Ù‰ ØªØ¹Ø¨Ø¦Ø© ÙƒØ§ÙØ© Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©' : 'Please fill all required fields');
      return;
    }

    const qtyScaled = Math.round(parseFloat(formQtyUnits || '0') * 10000);
    if (qtyScaled <= 0) {
      setCreateError(isRtl ? 'Ø§Ù„ÙƒÙ…ÙŠØ© ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±' : 'Planned quantity must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      await api.workOrders.create({
        orderNumber: formOrderNumber.trim().toUpperCase(),
        itemId: formItemId,
        plannedQuantityScaled: qtyScaled,
        dueDate: new Date(formDueDate).toISOString(),
        notes: formNotes.trim() || undefined,
      });
      setCreateModalOpen(false);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error creating work order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async (id: string) => {
    await api.workOrders.release(id);
    await loadData();
  };

  const handleStart = async (id: string) => {
    await api.workOrders.start(id);
    await loadData();
  };

  const openCompleteModal = (wo: WorkOrderRow) => {
    setActiveWo(wo);
    const plannedUnits = (wo.planned_quantity_scaled / 10000).toString();
    setCompleteYieldUnits(plannedUnits);
    setCompleteScrapUnits('0');
    setCompleteNotes('');
    setCompleteError('');
    setCompleteModalOpen(true);
  };

  const handleExecuteComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWo) return;

    const yieldScaled = Math.round(parseFloat(completeYieldUnits || '0') * 10000);
    const scrapScaled = Math.round(parseFloat(completeScrapUnits || '0') * 10000);

    if (yieldScaled < 0 || scrapScaled < 0) {
      setCompleteError(isRtl ? 'Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø£Ù† ØªÙƒÙˆÙ† Ø³Ø§Ù„Ø¨Ø©' : 'Quantities cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      await api.workOrders.complete(activeWo.id, {
        yieldQuantityScaled: yieldScaled,
        scrapQuantityScaled: scrapScaled,
        targetLotId: activeWo.target_lot_id || `lot-${Date.now()}`,
        targetLocationId: 'loc-fg-main',
      });
      setCompleteModalOpen(false);
      setActiveWo(null);
      await loadData();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Error completing work order');
    } finally {
      setSubmitting(false);
    }
  };

  const openCancelModal = (wo: WorkOrderRow) => {
    setActiveWo(wo);
    setCancelReason('');
    setCancelError('');
    setCancelModalOpen(true);
  };

  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWo) return;

    setSubmitting(true);
    try {
      await api.workOrders.cancel(activeWo.id, cancelReason.trim() || undefined);
      setCancelModalOpen(false);
      setActiveWo(null);
      await loadData();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Error cancelling work order');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.order_number.toLowerCase().includes(q.toLowerCase()) ||
      (r.item_name && r.item_name.includes(q)) ||
      (r.notes && r.notes.includes(q)),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.workOrders.title')}</h1>
          <p className="page-sub">{t('page.workOrders.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent)',
            fontWeight: 600,
            paddingInline: 'var(--space-4)',
          }}
          onClick={openNewWorkOrderModal}
        >
          <IconFactory />
          {t('action.new')}
        </button>
      </div>

      <section className="card">
        <ol className="stepper" aria-label={t('stepper.label')}>
          {STEPS.map((s, i) => {
            const isSelected = selectedStatus === s.status;
            return (
              <li
                key={s.status}
                className="step"
                style={{ cursor: 'pointer' }}
                data-state={isSelected ? 'current' : 'todo'}
                onClick={() => setSelectedStatus(isSelected ? 'ALL' : s.status)}
              >
                {i > 0 && <span className="step-bar" aria-hidden />}
                <span className="step-dot num">{num(i + 1)}</span>
                <span>{t(s.label)}</span>
              </li>
            );
          })}
        </ol>

        <div className="toolbar" style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <label htmlFor={searchInputId} className="visually-hidden">
            {t('page.workOrders.search')}
          </label>
          <input
            id={searchInputId}
            className="input"
            type="search"
            aria-label={t('page.workOrders.search')}
            placeholder={t('page.workOrders.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => loadData()}>
            {t('action.refresh')}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('col.number')}</th>
                <th scope="col">{t('col.item')}</th>
                <th scope="col">{t('col.lot')}</th>
                <th scope="col" className="col-num">{t('col.qty')}</th>
                <th scope="col" className="col-num">{t('col.cost')}</th>
                <th scope="col">{t('col.due')}</th>
                <th scope="col">{t('col.status')}</th>
                <th scope="col">{t('col.qc')}</th>
                <th scope="col">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.empty')}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const qtyDisplay = (r.planned_quantity_scaled / 10000).toFixed(2);
                  const costMinor = Math.round((r.planned_quantity_scaled / 10000) * 1250);
                  const progress =
                    r.status === 'COMPLETED'
                      ? 100
                      : r.status === 'IN_PROGRESS'
                        ? 60
                        : 0;

                  return (
                    <tr key={r.id}>
                      <td>
                        <bdi className="ltr-code" dir="ltr" style={{ fontWeight: 600 }}>
                          {r.order_number}
                        </bdi>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.item_name || r.item_id}</div>
                        {r.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', maxInlineSize: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <LotBadge
                          code={r.lot_number || (r.target_lot_id ? r.target_lot_id.slice(0, 10) : 'LT-PENDING')}
                        />
                      </td>
                      <td className="col-num num">
                        {num(qtyDisplay, 2)}
                        {r.status === 'COMPLETED' && r.yield_quantity_scaled > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-success)' }}>
                            âœ“ {num(r.yield_quantity_scaled / 10000, 2)}
                          </div>
                        )}
                        {r.status === 'COMPLETED' && r.scrap_quantity_scaled > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)' }}>
                            âœ— {num(r.scrap_quantity_scaled / 10000, 2)}
                          </div>
                        )}
                      </td>
                      <td className="col-num num">{money(costMinor)}</td>
                      <td className="num">{date(r.due_date)}</td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                          <StatusChip {...statusTone(r.status)} />
                          {r.status !== 'CANCELLED' && (
                            <span
                              className="progress"
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={{ inlineSize: `${progress}%` }} />
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <StatusChip {...qcTone(r.qc_status)} />
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                          {r.status === 'DRAFT' && (
                            <button
                              type="button"
                              className="btn touch-btn" style={{ minBlockSize: '40px', paddingInline: 'var(--space-3)', fontSize: '13px' }}
                              onClick={() => handleRelease(r.id)}
                            >
                              {t('action.release')}
                            </button>
                          )}
                          {r.status === 'RELEASED' && (
                            <button
                              type="button"
                              className="btn touch-btn" style={{ minBlockSize: '40px', paddingInline: 'var(--space-3)', fontSize: '13px', background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
                              onClick={() => handleStart(r.id)}
                            >
                              {t('action.start')}
                            </button>
                          )}
                          {r.status === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              className="btn touch-btn" style={{ minBlockSize: '40px', paddingInline: 'var(--space-3)', fontSize: '13px', background: 'var(--color-success)', color: '#fff', borderColor: 'transparent' }}
                              onClick={() => openCompleteModal(r)}
                            >
                              {t('action.complete')}
                            </button>
                          )}
                          {r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="btn touch-btn" style={{ minBlockSize: '40px', paddingInline: 'var(--space-3)', fontSize: '13px', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              onClick={() => openCancelModal(r)}
                            >
                              {t('action.cancel')}
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

        <div className="table-foot">
          <button type="button" className="btn">
            <ChevronBack />
            {t('page.prev')}
          </button>
          <button type="button" className="btn">
            {t('page.next')}
            <ChevronForward />
          </button>
        </div>
      </section>

      {/* New Work Order Modal */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              inlineSize: '100%',
              maxInlineSize: 580,
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ marginBlockEnd: 'var(--space-4)', fontSize: '1.15rem' }}>
              {t('dialog.newWorkOrder.title')}
            </h2>

            {createError && (
              <div
                style={{
                  background: 'var(--color-danger-soft)',
                  color: 'var(--color-danger)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBlockEnd: 'var(--space-3)',
                  fontSize: '0.85rem',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  htmlFor={orderNumberInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.orderNumber')} *
                </label>
                <input
                  id={orderNumberInputId}
                  className="input"
                  dir="ltr"
                  value={formOrderNumber}
                  onChange={(e) => setFormOrderNumber(e.target.value)}
                  style={{ inlineSize: '100%' }}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={recipeSelectId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.recipe')}
                </label>
                <select
                  id={recipeSelectId}
                  className="input select"
                  value={formRecipeId}
                  onChange={(e) => handleRecipeChange(e.target.value)}
                  style={{ inlineSize: '100%' }}
                >
                  <option value="">{isRtl ? '-- Ø­Ø¯Ø¯ ÙˆØµÙØ© Ù…Ø¹ÙŠØ§Ø±ÙŠØ© Ø£Ùˆ Ø§Ø®ØªØ± Ø§Ù„ØµÙ†Ù Ù…Ø¨Ø§Ø´Ø±Ø© --' : '-- Select Recipe or pick Item below --'}</option>
                  {recipes.map((rcp) => (
                    <option key={rcp.id} value={rcp.id}>
                      {rcp.code} - {isRtl ? rcp.name_ar : rcp.name_en} ({rcp.output_uom})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor={itemSelectId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('dialog.item')} *
                  </label>
                  <select
                    id={itemSelectId}
                    className="input select"
                    value={formItemId}
                    onChange={(e) => setFormItemId(e.target.value)}
                    style={{ inlineSize: '100%' }}
                    required
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} - {isRtl ? it.name_ar : it.name_en} ({it.uom_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={plannedQtyInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('dialog.quantity')} *
                  </label>
                  <input
                    id={plannedQtyInputId}
                    className="input"
                    type="number"
                    min="1"
                    step="any"
                    value={formQtyUnits}
                    onChange={(e) => setFormQtyUnits(e.target.value)}
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={dueDateInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.dueDate')} *
                </label>
                <input
                  id={dueDateInputId}
                  className="input"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  style={{ inlineSize: '100%' }}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={notesTextareaId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.notes')}
                </label>
                <textarea
                  id={notesTextareaId}
                  className="input"
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  style={{ inlineSize: '100%', height: 'auto', padding: '8px' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBlockStart: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={submitting}
                >
                  {t('dialog.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting}
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-on-accent)',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? t('msg.loading') : t('dialog.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Work Order Modal (Yield & Scrap Logging) */}
      {completeModalOpen && activeWo && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              inlineSize: '100%',
              maxInlineSize: 520,
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ marginBlockEnd: 'var(--space-2)', fontSize: '1.15rem' }}>
              {t('dialog.completeWorkOrder.title')}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBlockEnd: 'var(--space-4)' }}>
              {activeWo.order_number} - {activeWo.item_name || activeWo.item_id}
            </p>

            {completeError && (
              <div
                style={{
                  background: 'var(--color-danger-soft)',
                  color: 'var(--color-danger)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBlockEnd: 'var(--space-3)',
                  fontSize: '0.85rem',
                }}
              >
                {completeError}
              </div>
            )}

            <form onSubmit={handleExecuteComplete} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor={actualYieldInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('dialog.actualYield')} *
                  </label>
                  <input
                    id={actualYieldInputId}
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    value={completeYieldUnits}
                    onChange={(e) => setCompleteYieldUnits(e.target.value)}
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor={actualScrapInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('dialog.actualScrap')}
                  </label>
                  <input
                    id={actualScrapInputId}
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    value={completeScrapUnits}
                    onChange={(e) => setCompleteScrapUnits(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={completeNotesInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.scrapReason')}
                </label>
                <input
                  id={completeNotesInputId}
                  className="input"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder={isRtl ? 'Ù…Ø«Ø§Ù„: ØªÙ…Øª Ù…Ø·Ø§Ø¨Ù‚Ø© ÙØ­Øµ Ø§Ù„Ø¬ÙˆØ¯Ø© Ø¨Ù†Ø¬Ø§Ø­' : 'e.g. Quality inspection passed'}
                  style={{ inlineSize: '100%' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBlockStart: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCompleteModalOpen(false)}
                  disabled={submitting}
                >
                  {t('dialog.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting}
                  style={{
                    background: 'var(--color-success)',
                    color: '#fff',
                    borderColor: 'transparent',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? t('msg.loading') : t('action.complete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Work Order Modal */}
      {cancelModalOpen && activeWo && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              inlineSize: '100%',
              maxInlineSize: 480,
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ marginBlockEnd: 'var(--space-2)', fontSize: '1.15rem' }}>
              {t('dialog.cancelWorkOrder.title')}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBlockEnd: 'var(--space-4)' }}>
              {activeWo.order_number} - {activeWo.item_name || activeWo.item_id}
            </p>

            {cancelError && (
              <div
                style={{
                  background: 'var(--color-danger-soft)',
                  color: 'var(--color-danger)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBlockEnd: 'var(--space-3)',
                  fontSize: '0.85rem',
                }}
              >
                {cancelError}
              </div>
            )}

            <form onSubmit={handleExecuteCancel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  htmlFor={cancelReasonInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('dialog.cancelReason')} *
                </label>
                <input
                  id={cancelReasonInputId}
                  className="input"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={isRtl ? 'Ù…Ø«Ø§Ù„: ØªØ¹Ø¯ÙŠÙ„ Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø¥Ù†ØªØ§Ø¬ Ù…Ù† Ù‚Ø¨Ù„ Ø§Ù„Ø¹Ù…ÙŠÙ„' : 'e.g. Schedule revised by customer'}
                  style={{ inlineSize: '100%' }}
                  required
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBlockStart: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={submitting}
                >
                  {t('dialog.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting}
                  style={{
                    background: 'var(--color-danger)',
                    color: '#fff',
                    borderColor: 'transparent',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? t('msg.loading') : t('action.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

