import { useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import { api, type LabPersistentData } from '../api/client';

export function SettingsPage() {
  const { t, dir } = usePrefs();
  const isRtl = dir === 'rtl';
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState('');

  const executeWipe = async () => {
    const validKeyword = isRtl ? 'مسح' : 'WIPE';
    if (
      typedConfirm.trim().toUpperCase() !== validKeyword &&
      typedConfirm.trim() !== 'مسح' &&
      typedConfirm.trim().toUpperCase() !== 'WIPE'
    ) {
      alert(isRtl ? 'يرجى كتابة كلمة التأكيد بشكل صحيح' : 'Please type the confirmation keyword correctly');
      return;
    }
    await api.system.resetToEmpty();
    setSafetyModalOpen(false);
    setStatusMsg(
      isRtl
        ? 'تم مسح البيانات بنجاح. النظام فارغ وجاهز لبيانات عملك.'
        : 'All data wiped. System is completely blank and ready for your business data.',
    );
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleResetEmpty = () => {
    setTypedConfirm('');
    setSafetyModalOpen(true);
  };

  const handleSeedDefaults = async () => {
    if (
      window.confirm(
        isRtl
          ? 'هل تريد تحميل البيانات الإرشادية لقطاعي الأغذية والملبوسات؟'
          : 'Load Food & Beverage and Textile industrial benchmark data?',
      )
    ) {
      await api.system.seedDefaultData();
      setStatusMsg(
        isRtl ? 'تم تحميل البيانات الإرشادية بنجاح.' : 'Benchmark data loaded successfully.',
      );
      setTimeout(() => window.location.reload(), 1200);
    }
  };

  const handleExport = async () => {
    const dataObj = await api.system.exportData();
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(
      isRtl ? 'تم تصدير النسخة الاحتياطية بنجاح.' : 'Backup JSON exported successfully.',
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text) as LabPersistentData;
        await api.system.importData(parsed);
        setStatusMsg(isRtl ? 'تم استيراد البيانات بنجاح.' : 'Data imported successfully.');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        alert(isRtl ? 'ملف النسخة الاحتياطية غير صالح' : 'Invalid backup JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.settings')}</h1>
          <p className="page-sub">
            {isRtl
              ? 'إدارة قاعدة البيانات المحلية والنسخ الاحتياطي والبدء من الصفر'
              : 'Local database management, backup export/import and workspace initialization'}
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3)',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            fontWeight: 600,
          }}
        >
          {statusMsg}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Clean Slate & Initialization */}
        <section className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-2)' }}>
            {isRtl ? 'تهيئة منصة العمل (Clean Slate)' : 'Workspace Initialization'}
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              marginBlockEnd: 'var(--space-4)',
            }}
          >
            {isRtl
              ? 'تفريغ كافة السجلات للبدء بقاعدة بيانات حقيقية فارغة تماماً دون أي بيانات تجريبية.'
              : 'Wipe all records to start with a completely empty, real database with zero demo seed data.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-danger touch-btn" onClick={handleResetEmpty}>
              {isRtl ? 'بدء منصة عمل فارغة (صفر بيانات)' : 'Start with Empty Workspace (Zero Data)'}
            </button>
            <button type="button" className="btn btn-secondary touch-btn" onClick={handleSeedDefaults}>
              {isRtl ? 'إعادة تحميل النماذج الإرشادية' : 'Reload Benchmark Samples'}
            </button>
          </div>
        </section>

        {/* Backup & Portability */}
        <section className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-2)' }}>
            {isRtl ? 'النسخ الاحتياطي والتصدير (Data Portability)' : 'Backup & Data Portability'}
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              marginBlockEnd: 'var(--space-4)',
            }}
          >
            {isRtl
              ? 'حفظ أو استعادة كافة الأصناف، الوصفات، حركات المخزون، وأوامر التشغيل كملف JSON مستقل.'
              : 'Save or restore all items, recipes, stock movements, and work orders as an offline JSON archive.'}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button type="button" className="btn btn-primary touch-btn" onClick={handleExport}>
              {isRtl ? 'تصدير نسخة احتياطية (JSON)' : 'Export Backup (JSON)'}
            </button>
            <label className="btn btn-secondary touch-btn" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
              <span>{isRtl ? 'استيراد نسخة سابقة' : 'Import Backup File'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </section>
      </div>

      {/* Industrial Safety Modal */}
      {safetyModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              inlineSize: '420px',
              padding: 'var(--space-4)',
              border: '2px solid var(--color-danger)',
            }}
          >
            <h3 style={{ color: 'var(--color-danger)', marginBlockEnd: 'var(--space-2)' }}>
              {t('modal.confirmTitle')}
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                marginBlockEnd: 'var(--space-3)',
              }}
            >
              {t('modal.confirmWipeDesc')}
            </p>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                marginBlockEnd: 'var(--space-1)',
              }}
            >
              {t('modal.confirmKeywordPrompt')}
            </label>
            <input
              className="input"
              type="text"
              autoFocus
              placeholder={isRtl ? 'مسح' : 'WIPE'}
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              style={{ inlineSize: '100%', marginBlockEnd: 'var(--space-4)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn touch-btn"
                onClick={() => setSafetyModalOpen(false)}
              >
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger touch-btn"
                onClick={executeWipe}
              >
                {t('action.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
