import { useEffect, useState, useMemo, useId } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import {
  api,
  type RecipeDto,
  type CostBreakdownDto,
  type IndustryVertical,
  type ItemDto,
  type WorkCenterDto,
} from '../api/client';
import { IconFlask } from '../components/icons';

interface RecipeItemFormState {
  itemId: string;
  quantityUnits: string;
  scrapPct: string;
  notes: string;
}

interface RecipeRoutingFormState {
  workCenterCode: string;
  stepOrder: number;
  nameAr: string;
  nameEn: string;
  setupTimeMins: string;
  runTimeMinsScaled: string;
  laborHeadcount: string;
}

interface RecipeByproductFormState {
  itemId: string;
  yieldQuantityUnits: string;
  salvageValueMajor: string;
  notes: string;
}

export function RecipesPage() {
  const { t, num, money, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [verticalFilter, setVerticalFilter] = useState<'ALL' | IndustryVertical>('ALL');
  const [recipes, setRecipes] = useState<RecipeDto[]>([]);
  const [items, setItems] = useState<ItemDto[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterDto[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdownDto | null>(null);
  const [simBatchMultiplier, setSimBatchMultiplier] = useState<number>(1);
  const [simMaterialPriceDeltaPct, setSimMaterialPriceDeltaPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Modal State for Create / Edit Recipe
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeDto | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formVertical, setFormVertical] = useState<IndustryVertical>('FOOD_BEV');
  const [formOutputItemId, setFormOutputItemId] = useState('');
  const [formBaseQtyUnits, setFormBaseQtyUnits] = useState('1000');
  const [formExpectedYieldPct, setFormExpectedYieldPct] = useState('98');
  const [formOverheadFlatMajor, setFormOverheadFlatMajor] = useState('0.00');

  // Sub-items forms
  const [formItems, setFormItems] = useState<RecipeItemFormState[]>([]);
  const [formRoutings, setFormRoutings] = useState<RecipeRoutingFormState[]>([]);
  const [formByproducts, setFormByproducts] = useState<RecipeByproductFormState[]>([]);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const codeInputId = useId();
  const vertSelectId = useId();
  const nameArInputId = useId();
  const nameEnInputId = useId();
  const outItemSelectId = useId();
  const baseQtyInputId = useId();
  const yieldPctInputId = useId();
  const overheadInputId = useId();
  const batchScaleSelectId = useId();
  const priceShiftSelectId = useId();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [recipeList, itemList, wcList] = await Promise.all([
        api.recipes.list(),
        api.items.list(),
        api.workCenters.list(),
      ]);
      setRecipes(recipeList);
      setItems(itemList);
      setWorkCenters(wcList);

      if (recipeList.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(recipeList[0]!.id);
      } else if (
        recipeList.length > 0 &&
        !recipeList.some((r) => r.id === selectedRecipeId)
      ) {
        setSelectedRecipeId(recipeList[0]!.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRecipe = useMemo(() => {
    return recipes.find((r) => r.id === selectedRecipeId) ?? null;
  }, [recipes, selectedRecipeId]);

  useEffect(() => {
    async function recalculate() {
      if (!selectedRecipe) {
        setCostBreakdown(null);
        return;
      }
      const baseScaled = selectedRecipe.base_quantity_scaled;
      const targetScaled = Math.round(baseScaled * simBatchMultiplier);
      const res = await api.recipes.calculateCost(selectedRecipe.id, targetScaled);
      setCostBreakdown(res);
    }
    recalculate();
  }, [selectedRecipe, simBatchMultiplier]);

  const filteredRecipes = useMemo(() => {
    if (verticalFilter === 'ALL') return recipes;
    return recipes.filter((r) => r.industry_vertical === verticalFilter);
  }, [recipes, verticalFilter]);

  // Simulated metrics considering material price spike
  const simulatedCost = useMemo(() => {
    if (!costBreakdown) return null;
    const materialSpikeFactor = 1 + simMaterialPriceDeltaPct / 100;
    const simMaterial = Math.round(costBreakdown.totalDirectMaterialMinor * materialSpikeFactor);
    const simTotal =
      simMaterial +
      costBreakdown.totalDirectLaborMinor +
      costBreakdown.totalMachineOverheadMinor -
      costBreakdown.byproductCreditMinor;
    const yieldUnits = costBreakdown.expectedYieldQtyScaled / 10000;
    const simUnitCost = yieldUnits > 0 ? Math.round(simTotal / yieldUnits) : 0;
    const baselineUnitCost = costBreakdown.unitCostMinor;
    const deltaUnitCost = simUnitCost - baselineUnitCost;

    return {
      simMaterial,
      simTotal,
      simUnitCost,
      deltaUnitCost,
    };
  }, [costBreakdown, simMaterialPriceDeltaPct]);

  // Modal Open Handlers
  const openCreateModal = () => {
    setEditingRecipe(null);
    setFormCode('');
    setFormNameAr('');
    setFormNameEn('');
    setFormVertical('FOOD_BEV');
    const finishedItems = items.filter((i) => i.type === 'FINISHED');
    setFormOutputItemId(finishedItems.length > 0 ? finishedItems[0]!.id : items[0]?.id || '');
    setFormBaseQtyUnits('1000');
    setFormExpectedYieldPct('98');
    setFormOverheadFlatMajor('0.00');

    // Default 1 material and 1 routing
    const defaultRaw = items.find((i) => i.type === 'RAW') || items[0];
    setFormItems(
      defaultRaw
        ? [
            {
              itemId: defaultRaw.id,
              quantityUnits: '1000',
              scrapPct: '2.0',
              notes: '',
            },
          ]
        : [],
    );

    const defaultWc = workCenters[0];
    setFormRoutings(
      defaultWc
        ? [
            {
              workCenterCode: defaultWc.code,
              stepOrder: 1,
              nameAr: 'مرحلة الإعداد والتشغيل الرئيسية',
              nameEn: 'Main Setup & Production Operation',
              setupTimeMins: '15',
              runTimeMinsScaled: '60',
              laborHeadcount: '2',
            },
          ]
        : [],
    );
    setFormByproducts([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (recipe: RecipeDto) => {
    setEditingRecipe(recipe);
    setFormCode(recipe.code);
    setFormNameAr(recipe.name_ar);
    setFormNameEn(recipe.name_en);
    setFormVertical(recipe.industry_vertical);
    setFormOutputItemId(recipe.output_item_id);
    setFormBaseQtyUnits((recipe.base_quantity_scaled / 10000).toString());
    setFormExpectedYieldPct(((recipe.expected_yield_pct_scaled || 1000000) / 10000).toString());
    setFormOverheadFlatMajor(((recipe.overhead_flat_minor || 0) / 100).toFixed(2));

    setFormItems(
      (recipe.items || []).map((it) => ({
        itemId: it.item_id,
        quantityUnits: (it.quantity_scaled / 10000).toString(),
        scrapPct: ((it.scrap_tolerance_pct_scaled || 0) / 10000).toString(),
        notes: it.notes || '',
      })),
    );

    setFormRoutings(
      (recipe.routings || []).map((rt) => ({
        workCenterCode: rt.work_center_code,
        stepOrder: rt.step_order,
        nameAr: rt.name_ar,
        nameEn: rt.name_en,
        setupTimeMins: rt.setup_time_mins.toString(),
        runTimeMinsScaled: (rt.run_time_mins_scaled / 10000).toString(),
        laborHeadcount: rt.labor_headcount.toString(),
      })),
    );

    setFormByproducts(
      (recipe.byproducts || []).map((bp) => ({
        itemId: bp.item_id,
        yieldQuantityUnits: (bp.yield_quantity_scaled / 10000).toString(),
        salvageValueMajor: ((bp.salvage_value_minor || 0) / 100).toFixed(2),
        notes: bp.notes || '',
      })),
    );

    setFormError('');
    setModalOpen(true);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formNameAr.trim() || !formNameEn.trim() || !formOutputItemId) {
      setFormError(isRtl ? 'يرجى تعبئة كافة الحقول الأساسية' : 'Please fill all required base fields');
      return;
    }

    if (formItems.length === 0) {
      setFormError(isRtl ? 'يرجى إضافة مكون أو مادة خام واحدة على الأقل' : 'Please add at least one BOM ingredient');
      return;
    }

    const baseQtyScaled = Math.round(parseFloat(formBaseQtyUnits || '1') * 10000);
    const expectedYieldScaled = Math.round(parseFloat(formExpectedYieldPct || '100') * 10000);
    const overheadMinor = Math.round(parseFloat(formOverheadFlatMajor || '0') * 100);

    const payloadItems = formItems.map((it) => ({
      item_id: it.itemId,
      quantity_scaled: Math.round(parseFloat(it.quantityUnits || '0') * 10000),
      scrap_tolerance_pct_scaled: Math.round(parseFloat(it.scrapPct || '0') * 10000),
      notes: it.notes.trim() || undefined,
    }));

    const payloadRoutings = formRoutings.map((rt, idx) => ({
      work_center_code: rt.workCenterCode,
      step_order: idx + 1,
      name_ar: rt.nameAr.trim(),
      name_en: rt.nameEn.trim(),
      setup_time_mins: parseInt(rt.setupTimeMins || '0', 10),
      run_time_mins_scaled: Math.round(parseFloat(rt.runTimeMinsScaled || '0') * 10000),
      labor_headcount: parseInt(rt.laborHeadcount || '1', 10),
    }));

    const payloadByproducts = formByproducts.map((bp) => ({
      item_id: bp.itemId,
      yield_quantity_scaled: Math.round(parseFloat(bp.yieldQuantityUnits || '0') * 10000),
      salvage_value_minor: Math.round(parseFloat(bp.salvageValueMajor || '0') * 100),
      notes: bp.notes.trim() || undefined,
    }));

    setSubmitting(true);
    try {
      if (editingRecipe) {
        await api.recipes.update(editingRecipe.id, {
          code: formCode.trim().toUpperCase(),
          name_ar: formNameAr.trim(),
          name_en: formNameEn.trim(),
          industry_vertical: formVertical,
          output_item_id: formOutputItemId,
          base_quantity_scaled: baseQtyScaled,
          expected_yield_pct_scaled: expectedYieldScaled,
          overhead_flat_minor: overheadMinor,
          items: payloadItems,
          routings: payloadRoutings,
          byproducts: payloadByproducts,
        });
        setSelectedRecipeId(editingRecipe.id);
      } else {
        const created = await api.recipes.create({
          code: formCode.trim().toUpperCase(),
          name_ar: formNameAr.trim(),
          name_en: formNameEn.trim(),
          industry_vertical: formVertical,
          output_item_id: formOutputItemId,
          base_quantity_scaled: baseQtyScaled,
          expected_yield_pct_scaled: expectedYieldScaled,
          overhead_flat_minor: overheadMinor,
          items: payloadItems,
          routings: payloadRoutings,
          byproducts: payloadByproducts,
        });
        setSelectedRecipeId(created.id);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error saving recipe');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingRecipe, setDeletingRecipe] = useState<RecipeDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteRecipe = (recipe: RecipeDto) => {
    setDeletingRecipe(recipe);
    setDeleteError(null);
  };

  const executeDeleteRecipe = async () => {
    if (!deletingRecipe) return;
    try {
      await api.recipes.delete(deletingRecipe.id);
      setDeletingRecipe(null);
      await loadAll();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete recipe');
    }
  };

  // Add sub-row items in form
  const addFormItemRow = () => {
    const fallbackItem = items[0]?.id || '';
    setFormItems((prev) => [
      ...prev,
      {
        itemId: fallbackItem,
        quantityUnits: '1',
        scrapPct: '0',
        notes: '',
      },
    ]);
  };

  const removeFormItemRow = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addFormRoutingRow = () => {
    const fallbackWc = workCenters[0]?.code || 'WC-DEFAULT';
    setFormRoutings((prev) => [
      ...prev,
      {
        workCenterCode: fallbackWc,
        stepOrder: prev.length + 1,
        nameAr: `مرحلة تشغيل رقم ${prev.length + 1}`,
        nameEn: `Operation Step ${prev.length + 1}`,
        setupTimeMins: '10',
        runTimeMinsScaled: '60',
        laborHeadcount: '1',
      },
    ]);
  };

  const removeFormRoutingRow = (index: number) => {
    setFormRoutings((prev) => prev.filter((_, i) => i !== index));
  };

  const addFormByproductRow = () => {
    const fallbackItem = items[0]?.id || '';
    setFormByproducts((prev) => [
      ...prev,
      {
        itemId: fallbackItem,
        yieldQuantityUnits: '1',
        salvageValueMajor: '0.00',
        notes: '',
      },
    ]);
  };

  const removeFormByproductRow = (index: number) => {
    setFormByproducts((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="card" style={{ padding: 'var(--space-5)' }}>{t('msg.loading')}</div>;
  }

  return (
    <div className="recipes-studio">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('page.recipes.title')}</h1>
          <p className="page-sub">{t('page.recipes.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent)',
              fontWeight: 600,
            }}
            onClick={openCreateModal}
          >
            <IconFlask />
            {t('action.newRecipe')}
          </button>
        </div>
      </div>

      <div
        className="filter-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBlockEnd: 'var(--space-4)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div className="filter-group" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className={`btn ${verticalFilter === 'ALL' ? 'btn-primary' : ''}`}
            onClick={() => setVerticalFilter('ALL')}
          >
            {t('tab.all')}
          </button>
          <button
            type="button"
            className={`btn ${verticalFilter === 'FOOD_BEV' ? 'btn-primary' : ''}`}
            onClick={() => setVerticalFilter('FOOD_BEV')}
          >
            {t('tab.food')}
          </button>
          <button
            type="button"
            className={`btn ${verticalFilter === 'GENERAL' ? 'btn-primary' : ''}`}
            onClick={() => setVerticalFilter('GENERAL')}
          >
            {t('industry.general')}
          </button>
        </div>

        {selectedRecipe && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 13 }}
              onClick={() => openEditModal(selectedRecipe)}
            >
              {t('action.edit')}
            </button>
            <button
              type="button"
              className="btn"
              style={{
                fontSize: 13,
                color: 'var(--color-danger)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
              onClick={() => handleDeleteRecipe(selectedRecipe)}
            >
              {t('action.delete')}
            </button>
          </div>
        )}
      </div>

      <div
        className="studio-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        {/* Left column: Recipe Selector */}
        <aside className="card recipe-list-card" style={{ padding: 'var(--space-3)' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-3)', fontSize: '0.95rem' }}>
            {isRtl ? 'قوائم التشغيل الصناعي' : 'Manufacturing Formulas'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredRecipes.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {t('msg.noRecipes')}
              </div>
            ) : (
              filteredRecipes.map((r) => {
                const isSelected = r.id === selectedRecipeId;
                const isFood = r.industry_vertical === 'FOOD_BEV';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipeId(r.id);
                      setSimBatchMultiplier(1);
                      setSimMaterialPriceDeltaPct(0);
                    }}
                    style={{
                      display: 'block',
                      inlineSize: '100%',
                      textAlign: 'start',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-bg-hover)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBlockEnd: 'var(--space-1)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {r.code}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-pill)',
                          background: isFood ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: isFood ? '#059669' : '#4f46e5',
                          fontWeight: 600,
                        }}
                      >
                        {isFood ? 'F&B' : 'GENERAL'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {isRtl ? r.name_ar : r.name_en}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBlockStart: '4px' }}>
                      {isRtl ? 'المنتج: ' : 'Product: '}
                      {isRtl ? r.output_item_name_ar : r.output_item_name_en}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right column: Business Analyst Unit Economics & Deep Cost Breakdown */}
        {selectedRecipe && costBreakdown ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Top KPI Cards: Analyst Unit Economics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              <div className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {t('lbl.costPerUnit')}
                </div>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    marginBlock: 'var(--space-1)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {money(simulatedCost?.simUnitCost ?? costBreakdown.unitCostMinor)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {isRtl ? 'الدفعة المعيارية: ' : 'Standard Batch: '}
                  {num(selectedRecipe.base_quantity_scaled / 10000)} {selectedRecipe.output_uom}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {t('lbl.totalBatchCost')}
                </div>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    marginBlock: 'var(--space-1)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {money(simulatedCost?.simTotal ?? costBreakdown.totalBatchCostMinor)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {isRtl ? 'معدل الإنجاز: ' : 'Yield: '}
                  {num((selectedRecipe.expected_yield_pct_scaled || 1000000) / 10000)}%
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {t('lbl.directMaterials')}
                </div>
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    marginBlock: 'var(--space-1)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {money(simulatedCost?.simMaterial ?? costBreakdown.totalDirectMaterialMinor)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {Math.round(
                    ((simulatedCost?.simMaterial ?? costBreakdown.totalDirectMaterialMinor) /
                      (simulatedCost?.simTotal || 1)) *
                      100,
                  )}
                  % {isRtl ? 'من إجمالي التكلفة' : 'of batch total'}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {t('lbl.directLabor')} + {t('lbl.machineOverhead')}
                </div>
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    marginBlock: 'var(--space-1)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {money(costBreakdown.totalDirectLaborMinor + costBreakdown.totalMachineOverheadMinor)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {isRtl ? 'استرداد نواتج عرضية: ' : 'By-product Offset: '}
                  {money(costBreakdown.byproductCreditMinor)}
                </div>
              </div>
            </div>

            {/* Interactive What-If Cost Simulator */}
            <div className="card" style={{ padding: 'var(--space-3)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{t('card.simulator')}</h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {isRtl
                      ? 'محاكاة تأثير تغير أسعار مدخلات الإنتاج وحجم الدفعات على هوامش الربحية'
                      : 'Simulate the impact of ingredient price surges and batch scaling on margins'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <label htmlFor={batchScaleSelectId} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{isRtl ? 'مضاعف الدفعة:' : 'Batch Scale:'}</span>
                    <select
                      id={batchScaleSelectId}
                      className="input"
                      value={simBatchMultiplier}
                      onChange={(e) => setSimBatchMultiplier(Number(e.target.value))}
                      style={{ padding: '3px 8px', inlineSize: 'auto' }}
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1.0x (Standard)</option>
                      <option value={2}>2.0x (Double)</option>
                      <option value={5}>5.0x (Mass Run)</option>
                    </select>
                  </label>

                  <label htmlFor={priceShiftSelectId} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{isRtl ? 'تغير سعر المواد الخام:' : 'Material Price Shift:'}</span>
                    <select
                      id={priceShiftSelectId}
                      className="input"
                      value={simMaterialPriceDeltaPct}
                      onChange={(e) => setSimMaterialPriceDeltaPct(Number(e.target.value))}
                      style={{ padding: '3px 8px', inlineSize: 'auto' }}
                    >
                      <option value={-10}>-10% (Discount)</option>
                      <option value={0}>0% (Standard Cost)</option>
                      <option value={10}>+10% (Inflation)</option>
                      <option value={25}>+25% (Severe Surge)</option>
                    </select>
                  </label>

                  {simulatedCost && simMaterialPriceDeltaPct !== 0 && (
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: simulatedCost.deltaUnitCost > 0 ? '#fef2f2' : '#ecfdf5',
                        color: simulatedCost.deltaUnitCost > 0 ? '#b91c1c' : '#047857',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isRtl ? 'أثر التكلفة للوحدة: ' : 'Unit Impact: '}
                      {simulatedCost.deltaUnitCost > 0 ? '+' : ''}
                      {money(simulatedCost.deltaUnitCost)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bill of Materials (BOM) Table */}
            <div className="card" style={{ padding: 'var(--space-3)' }}>
              <h3 style={{ marginBlockEnd: 'var(--space-3)', fontSize: '0.95rem' }}>
                {t('card.bomItems')}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ inlineSize: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'start' }}>{isRtl ? 'المكون / الصنف' : 'Item / Component'}</th>
                      <th style={{ textAlign: 'start' }}>{isRtl ? 'الكود' : 'SKU'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'الكمية المطلوبة' : 'Required Qty'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'نسبة الهدر المسموح' : 'Scrap / Loss %'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'سعر الوحدة' : 'Unit Cost'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'إجمالي تكلفة المادة' : 'Total Material Cost'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costBreakdown.itemsCost.map((it) => (
                      <tr key={it.itemId}>
                        <td style={{ fontWeight: 500 }}>{isRtl ? it.nameAr : it.nameEn}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{it.itemCode}</td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                          {num(it.quantityScaled / 10000)}
                        </td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                          {it.scrapPct > 0 ? `${num(it.scrapPct)}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                          {money(it.unitCostMinor)}
                        </td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {money(it.lineCostMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By-products Table if present */}
            {selectedRecipe.byproducts && selectedRecipe.byproducts.length > 0 && (
              <div className="card" style={{ padding: 'var(--space-3)' }}>
                <h3 style={{ marginBlockEnd: 'var(--space-3)', fontSize: '0.95rem' }}>
                  {t('card.byproducts')}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ inlineSize: '100%', fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'start' }}>{isRtl ? 'المنتج الثانوي' : 'By-Product Name'}</th>
                        <th style={{ textAlign: 'start' }}>{isRtl ? 'الكود' : 'SKU'}</th>
                        <th style={{ textAlign: 'end' }}>{isRtl ? 'كمية الاسترداد' : 'Yield Quantity'}</th>
                        <th style={{ textAlign: 'end' }}>{isRtl ? 'قيمة الاسترداد للوحدة' : 'Salvage Value / Unit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecipe.byproducts.map((bp) => (
                        <tr key={bp.id}>
                          <td style={{ fontWeight: 500 }}>{isRtl ? bp.item_name_ar : bp.item_name_en}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{bp.item_code}</td>
                          <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                            {num(bp.yield_quantity_scaled / 10000)} {bp.uom_code}
                          </td>
                          <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                            {money(bp.salvage_value_minor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Routing & Work Centers Table */}
            <div className="card" style={{ padding: 'var(--space-3)' }}>
              <h3 style={{ marginBlockEnd: 'var(--space-3)', fontSize: '0.95rem' }}>
                {t('card.routings')}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ inlineSize: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'start' }}>#</th>
                      <th style={{ textAlign: 'start' }}>{isRtl ? 'المحطة / مركز العمل' : 'Work Center'}</th>
                      <th style={{ textAlign: 'start' }}>{isRtl ? 'مرحلة التشغيل' : 'Operation Name'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'تكلفة العمالة' : 'Labor Cost'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'تكلفة المعدات' : 'Machine Cost'}</th>
                      <th style={{ textAlign: 'end' }}>{isRtl ? 'إجمالي تشغيل المرحلة' : 'Step Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costBreakdown.routingsCost.map((rt) => (
                      <tr key={rt.stepOrder}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{rt.stepOrder}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {rt.workCenterCode}
                        </td>
                        <td>{rt.stepNameEn}</td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                          {money(rt.laborCostMinor)}
                        </td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>
                          {money(rt.machineCostMinor)}
                        </td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {money(rt.totalStepCostMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
            {t('msg.noRecipes')}
          </div>
        )}
      </div>

      {/* Recipe Creation / Editing Modal */}
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
              maxInlineSize: 840,
              maxBlockSize: '90vh',
              overflowY: 'auto',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 style={{ marginBlockEnd: 'var(--space-4)', fontSize: '1.15rem' }}>
              {editingRecipe ? t('dialog.editRecipe.title') : t('dialog.newRecipe.title')}
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

            <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Fields */}
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
                    placeholder="e.g. RCP-NEW-01"
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor={vertSelectId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.industry')} *
                  </label>
                  <select
                    id={vertSelectId}
                    className="input select"
                    value={formVertical}
                    onChange={(e) => setFormVertical(e.target.value as IndustryVertical)}
                    style={{ inlineSize: '100%' }}
                  >
                    <option value="FOOD_BEV">{t('industry.food')}</option>
                    <option value="GENERAL">{t('industry.general')}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                    placeholder="مثال: خلطة عصير برتقال طبيعي"
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
                    placeholder="e.g. Natural Orange Juice Formula"
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor={outItemSelectId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.outputItem')} *
                  </label>
                  <select
                    id={outItemSelectId}
                    className="input select"
                    value={formOutputItemId}
                    onChange={(e) => setFormOutputItemId(e.target.value)}
                    style={{ inlineSize: '100%' }}
                    required
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} - {isRtl ? i.name_ar : i.name_en} ({i.uom_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={baseQtyInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.baseQuantity')} *
                  </label>
                  <input
                    id={baseQtyInputId}
                    className="input"
                    type="number"
                    min="1"
                    step="any"
                    value={formBaseQtyUnits}
                    onChange={(e) => setFormBaseQtyUnits(e.target.value)}
                    style={{ inlineSize: '100%' }}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor={yieldPctInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.expectedYieldPct')}
                  </label>
                  <input
                    id={yieldPctInputId}
                    className="input"
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    value={formExpectedYieldPct}
                    onChange={(e) => setFormExpectedYieldPct(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor={overheadInputId}
                    style={{ display: 'block', fontSize: '0.8rem', marginBlockEnd: 4, fontWeight: 500 }}
                  >
                    {t('field.overheadFlat')}
                  </label>
                  <input
                    id={overheadInputId}
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formOverheadFlatMajor}
                    onChange={(e) => setFormOverheadFlatMajor(e.target.value)}
                    style={{ inlineSize: '100%' }}
                  />
                </div>
              </div>

              {/* Bill of Materials (BOM) Items */}
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBlockEnd: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('field.recipeItems')} *</span>
                  <button type="button" className="btn" style={{ fontSize: 12 }} onClick={addFormItemRow}>
                    + {t('action.addIngredient')}
                  </button>
                </div>

                {formItems.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 2fr 36px',
                      gap: 8,
                      alignItems: 'center',
                      marginBlockEnd: 6,
                    }}
                  >
                    <select
                      className="input select"
                      aria-label={t('field.recipeItems')}
                      value={row.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, itemId: val } : r)),
                        );
                      }}
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} - {isRtl ? i.name_ar : i.name_en} ({i.uom_code})
                        </option>
                      ))}
                    </select>

                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="0"
                      aria-label={t('field.quantity')}
                      placeholder={t('field.quantity')}
                      value={row.quantityUnits}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, quantityUnits: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="0"
                      aria-label={t('field.scrapTolerance')}
                      placeholder={t('field.scrapTolerance')}
                      value={row.scrapPct}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, scrapPct: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      aria-label={t('dialog.notes')}
                      placeholder={t('dialog.notes')}
                      value={row.notes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, notes: val } : r)),
                        );
                      }}
                    />

                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '0 6px', color: 'var(--color-danger)' }}
                      onClick={() => removeFormItemRow(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Routings & Work Center Stages */}
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBlockEnd: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('field.recipeRoutings')}</span>
                  <button type="button" className="btn" style={{ fontSize: 12 }} onClick={addFormRoutingRow}>
                    + {t('action.addRouting')}
                  </button>
                </div>

                {formRoutings.map((rt, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1.5fr 1.5fr 1fr 1fr 1fr 36px',
                      gap: 8,
                      alignItems: 'center',
                      marginBlockEnd: 6,
                    }}
                  >
                    <select
                      className="input select"
                      aria-label={t('field.workCenter')}
                      value={rt.workCenterCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, workCenterCode: val } : r)),
                        );
                      }}
                    >
                      {workCenters.map((wc) => (
                        <option key={wc.id} value={wc.code}>
                          {wc.code} - {isRtl ? wc.name_ar : wc.name_en}
                        </option>
                      ))}
                    </select>

                    <input
                      className="input"
                      aria-label={t('field.operationNameAr')}
                      placeholder={t('field.operationNameAr')}
                      value={rt.nameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, nameAr: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      dir="ltr"
                      aria-label={t('field.operationNameEn')}
                      placeholder={t('field.operationNameEn')}
                      value={rt.nameEn}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, nameEn: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      type="number"
                      min="0"
                      aria-label={t('field.setupTime')}
                      placeholder={t('field.setupTime')}
                      value={rt.setupTimeMins}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, setupTimeMins: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      type="number"
                      min="0"
                      aria-label={t('field.runTime')}
                      placeholder={t('field.runTime')}
                      value={rt.runTimeMinsScaled}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, runTimeMinsScaled: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      type="number"
                      min="1"
                      aria-label={t('field.headcount')}
                      placeholder={t('field.headcount')}
                      value={rt.laborHeadcount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormRoutings((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, laborHeadcount: val } : r)),
                        );
                      }}
                    />

                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '0 6px', color: 'var(--color-danger)' }}
                      onClick={() => removeFormRoutingRow(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* By-products & Salvage offsets */}
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBlockEnd: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t('field.recipeByproducts')}</span>
                  <button type="button" className="btn" style={{ fontSize: 12 }} onClick={addFormByproductRow}>
                    + {t('action.addByproduct')}
                  </button>
                </div>

                {formByproducts.map((bp, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 2fr 36px',
                      gap: 8,
                      alignItems: 'center',
                      marginBlockEnd: 6,
                    }}
                  >
                    <select
                      className="input select"
                      aria-label={t('field.recipeByproducts')}
                      value={bp.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormByproducts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, itemId: val } : r)),
                        );
                      }}
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} - {isRtl ? i.name_ar : i.name_en} ({i.uom_code})
                        </option>
                      ))}
                    </select>

                    <input
                      className="input"
                      type="number"
                      step="any"
                      min="0"
                      aria-label={t('field.quantity')}
                      placeholder={t('field.quantity')}
                      value={bp.yieldQuantityUnits}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormByproducts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, yieldQuantityUnits: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={t('field.salvageValue')}
                      placeholder={t('field.salvageValue')}
                      value={bp.salvageValueMajor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormByproducts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, salvageValueMajor: val } : r)),
                        );
                      }}
                    />

                    <input
                      className="input"
                      aria-label={t('dialog.notes')}
                      placeholder={t('dialog.notes')}
                      value={bp.notes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormByproducts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, notes: val } : r)),
                        );
                      }}
                    />

                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '0 6px', color: 'var(--color-danger)' }}
                      onClick={() => removeFormByproductRow(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
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

      {/* Delete Recipe Confirmation Modal */}
      {deletingRecipe && (
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
              {t('msg.confirmDelete')} ({isRtl ? deletingRecipe.name_ar : deletingRecipe.name_en})
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
                onClick={() => setDeletingRecipe(null)}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDeleteRecipe}
              >
                {t('action.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
