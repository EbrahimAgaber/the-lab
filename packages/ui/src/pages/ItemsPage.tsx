import { useState, useEffect, useCallback, useId } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';
import { api, type ItemDto, type ItemType } from '../api/client';
import { IconBox } from '../components/icons';

const ITEM_TYPES: Array<{ type: ItemType; label: MessageKey }> = [
  { type: 'RAW', label: 'type.raw' },
  { type: 'PACKAGING', label: 'type.packaging' },
  { type: 'INTERMEDIATE', label: 'type.intermediate' },
  { type: 'FINISHED', label: 'type.finished' },
];

const UOM_OPTIONS = ['KG', 'G', 'L', 'ML', 'M', 'PCS', 'BOX', 'ROLL'];

export function ItemsPage() {
  const { t, money, num, lang } = usePrefs();
  const isRtl = lang === 'ar';
  const [items, setItems] = useState<ItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'ALL'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDto | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formType, setFormType] = useState<ItemType>('RAW');
  const [formUom, setFormUom] = useState('KG');
  const [formCostMajor, setFormCostMajor] = useState('0.00');
  const [formSellingPriceMajor, setFormSellingPriceMajor] = useState('0.00');
  const [formReorderPoint, setFormReorderPoint] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchInputId = useId();
  const filterTypeId = useId();
  const codeInputId = useId();
  const nameArInputId = useId();
  const nameEnInputId = useId();
  const typeSelectId = useId();
  const uomSelectId = useId();
  const costInputId = useId();
  const reorderInputId = useId();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.items.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormCode('');
    setFormNameAr('');
    setFormNameEn('');
    setFormType('RAW');
    setFormUom('KG');
    setFormCostMajor('0.00');
    setFormSellingPriceMajor('0.00');
    setFormReorderPoint('0');
    setFormIsActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item: ItemDto) => {
    setEditingItem(item);
    setFormCode(item.code);
    setFormNameAr(item.name_ar);
    setFormNameEn(item.name_en);
    setFormType(item.type);
    setFormUom(item.uom_code);
    setFormCostMajor((item.cost_minor / 100).toFixed(2));
    setFormSellingPriceMajor(((item.selling_price_minor || 0) / 100).toFixed(2));
    setFormReorderPoint((item.reorder_point_scaled / 10000).toString());
    setFormIsActive(item.is_active);
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formNameAr.trim() || !formNameEn.trim()) {
      setFormError(isRtl ? 'يرجى تعبئة كافة الحقول الإلزامية' : 'Please fill all required fields');
      return;
    }

    const costMinor = Math.round(parseFloat(formCostMajor || '0') * 100);
    const sellingPriceMinor = Math.round(parseFloat(formSellingPriceMajor || '0') * 100);
    const reorderScaled = Math.round(parseFloat(formReorderPoint || '0') * 10000);

    setSubmitting(true);
    try {
      if (editingItem) {
        await api.items.update(editingItem.id, {
          code: formCode.trim().toUpperCase(),
          name_ar: formNameAr.trim(),
          name_en: formNameEn.trim(),
          type: formType,
          uom_code: formUom,
          cost_minor: costMinor,
          selling_price_minor: sellingPriceMinor,
          reorder_point_scaled: reorderScaled,
          is_active: formIsActive,
        });
      } else {
        await api.items.create({
          code: formCode.trim().toUpperCase(),
          name_ar: formNameAr.trim(),
          name_en: formNameEn.trim(),
          type: formType,
          uom_code: formUom,
          cost_minor: costMinor,
          reorder_point_scaled: reorderScaled,
          is_active: formIsActive,
        });
      }
      setModalOpen(false);
      await loadItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error saving item');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingItem, setDeletingItem] = useState<ItemDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = (item: ItemDto) => {
    setDeletingItem(item);
    setDeleteError(null);
  };

  const executeDelete = async () => {
    if (!deletingItem) return;
    try {
      await api.items.delete(deletingItem.id);
      setDeletingItem(null);
      await loadItems();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const filtered = items.filter((item) => {
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (!q) return true;
    const lower = q.toLowerCase();
    return (
      item.code.toLowerCase().includes(lower) ||
      item.name_ar.includes(q) ||
      item.name_en.toLowerCase().includes(lower)
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.items.title')}</h1>
          <p className="page-sub">{t('page.items.subtitle')}</p>
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
          onClick={openCreateModal}
        >
          <IconBox />
          {t('action.newItem')}
        </button>
      </div>

      <section className="card">
        <div
          className="toolbar"
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
            <label htmlFor={searchInputId} className="visually-hidden">
              {t('page.items.search')}
            </label>
            <input
              id={searchInputId}
              className="input"
              type="search"
              aria-label={t('page.items.search')}
              placeholder={t('page.items.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minInlineSize: 260 }}
            />
            <label htmlFor={filterTypeId} className="visually-hidden">
              {t('field.type')}
            </label>
            <select
              id={filterTypeId}
              className="input select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ItemType | 'ALL')}
              style={{ inlineSize: 'auto' }}
            >
              <option value="ALL">{isRtl ? 'كافة الأنواع' : 'All Types'}</option>
              {ITEM_TYPES.map((it) => (
                <option key={it.type} value={it.type}>
                  {t(it.label)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn" onClick={() => loadItems()}>
            {t('action.refresh')}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('field.code')}</th>
                <th scope="col">{t('col.item')}</th>
                <th scope="col">{t('field.type')}</th>
                <th scope="col">{t('field.uom')}</th>
                <th scope="col" className="col-num">{t('field.cost')}</th>
                <th scope="col" className="col-num">{t('field.reorderPoint')}</th>
                <th scope="col">{t('field.active')}</th>
                <th scope="col">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                    {t('msg.noItems')}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <bdi className="ltr-code" dir="ltr" style={{ fontWeight: 600 }}>
                        {item.code}
                      </bdi>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{isRtl ? item.name_ar : item.name_en}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {isRtl ? item.name_en : item.name_ar}
                      </div>
                    </td>
                    <td>
                      <span
                        className="chip"
                        data-tone={
                          item.type === 'FINISHED'
                            ? 'success'
                            : item.type === 'RAW'
                              ? 'info'
                              : item.type === 'PACKAGING'
                                ? 'neutral'
                                : 'warning'
                        }
                      >
                        {item.type === 'RAW'
                          ? t('type.raw')
                          : item.type === 'PACKAGING'
                            ? t('type.packaging')
                            : item.type === 'INTERMEDIATE'
                              ? t('type.intermediate')
                              : t('type.finished')}
                      </span>
                    </td>
                    <td>
                      <span className="lot-badge" style={{ fontFamily: 'var(--font-mono)' }}>
                        {item.uom_code}
                      </span>
                    </td>
                    <td className="col-num num" style={{ fontWeight: 600 }}>
                      {money(item.cost_minor)}
                    </td>
                    <td className="col-num num">
                      {num(item.reorder_point_scaled / 10000)} {item.uom_code}
                    </td>
                    <td>
                      <span
                        className="chip"
                        data-tone={item.is_active ? 'success' : 'neutral'}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {item.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 12 }}
                          onClick={() => openEditModal(item)}
                        >
                          {t('action.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '3px 8px',
                            fontSize: 12,
                            color: 'var(--color-danger)',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                          }}
                          onClick={() => handleDelete(item)}
                        >
                          {t('action.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Item Modal (Create & Edit) */}
      {modalOpen && (
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
              maxInlineSize: 560,
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ marginBlockEnd: 'var(--space-4)', fontSize: '1.15rem' }}>
              {editingItem ? t('dialog.editItem.title') : t('dialog.newItem.title')}
            </h2>

            {formError && (
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
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor={codeInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.code')} *
                  </label>
                  <input
                    id={codeInputId}
                    className="input"
                    dir="ltr"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. RAW-SUG-01"
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor={typeSelectId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.type')} *
                  </label>
                  <select
                    id={typeSelectId}
                    className="input select"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ItemType)}
                    style={{ inlineSize: '100%' }}
                  >
                    {ITEM_TYPES.map((it) => (
                      <option key={it.type} value={it.type}>
                        {t(it.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor={nameArInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('field.nameAr')} *
                </label>
                <input
                  id={nameArInputId}
                  className="input"
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  placeholder="مثال: سكر قصب نقي مطحون"
                  style={{ inlineSize: '100%' }}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={nameEnInputId}
                  style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                >
                  {t('field.nameEn')} *
                </label>
                <input
                  id={nameEnInputId}
                  className="input"
                  dir="ltr"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="e.g. Pure Refined Cane Sugar"
                  style={{ inlineSize: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor={uomSelectId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.uom')} *
                  </label>
                  <select
                    id={uomSelectId}
                    className="input select"
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  >
                    {UOM_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={costInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.cost')}
                  </label>
                  <input
                    id={costInputId}
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCostMajor}
                    onChange={(e) => setFormCostMajor(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={reorderInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.reorderPoint')}
                  </label>
                  <input
                    id={reorderInputId}
                    className="input"
                    type="number"
                    step="1"
                    min="0"
                    value={formReorderPoint}
                    onChange={(e) => setFormReorderPoint(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  />
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span>{t('field.active')}</span>
              </label>

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
                  onClick={() => setModalOpen(false)}
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

      {/* Delete Item Confirmation Modal */}
      {deletingItem && (
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
              maxInlineSize: 420,
              padding: 'var(--space-4)',
              border: '2px solid var(--color-danger)',
            }}
          >
            <h3 style={{ color: 'var(--color-danger)', marginBlockEnd: 'var(--space-2)' }}>
              {t('modal.confirmTitle')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', marginBlockEnd: 'var(--space-3)' }}>
              {t('msg.confirmDelete')} ({isRtl ? deletingItem.name_ar : deletingItem.name_en})
            </p>
            {deleteError && (
              <div
                style={{
                  padding: 'var(--space-2)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--color-danger)',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBlockEnd: 'var(--space-3)',
                }}
              >
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDeletingItem(null)}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDelete}
              >
                {t('action.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
