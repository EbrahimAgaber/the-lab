import { useEffect, useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import { api, type SetupStateDto, type UserDto } from '../api/client';

export function SettingsPage() {
  const { t, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [setupState, setSetupState] = useState<SetupStateDto | null>(null);
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [state, me] = await Promise.all([
          api.admin.getSetupState().catch(() => null),
          api.auth.getMe().catch(() => null),
        ]);
        if (state) setSetupState(state);
        if (me) {
          setCurrentUser(me.user);
          setCapabilities(me.capabilities);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setErrorMsg(null);
    try {
      const res = await api.admin.createBackup();
      setStatusMsg(
        isRtl
          ? `تم إنشاء نسخة احتياطية آمنة لقاعدة البيانات بنجاح: ${res.backupId}`
          : `Database backup created successfully: ${res.backupId}`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.settings')}</h1>
          <p className="page-sub">
            {isRtl
              ? 'إدارة إعدادات المنشأة، الصلاحيات، والنسخ الاحتياطي لقاعدة البيانات'
              : 'Enterprise settings, RBAC capabilities, and database operations'}
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

      {errorMsg && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger)',
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Company Profile Card */}
        <section className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-3)' }}>
            {isRtl ? 'بيانات المنشأة والعملة' : 'Company & Currency Profile'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'الاسم بالعربية: ' : 'Arabic Name: '}</span>
              <strong>{setupState?.companyNameAr || (isRtl ? 'المعمل الذكي' : 'The Lab')}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'الاسم بالإنجليزية: ' : 'English Name: '}</span>
              <strong>{setupState?.companyNameEn || 'The Lab Manufacturing'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'العملة الأساسية: ' : 'Base Currency: '}</span>
              <strong>{setupState?.baseCurrency || 'SAR'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'ضريبة القيمة المضافة: ' : 'VAT Rate: '}</span>
              <strong>15%</strong>
            </div>
          </div>
        </section>

        {/* Database Backup & Maintenance Card */}
        <section className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-2)' }}>
            {isRtl ? 'النسخ الاحتياطي لقاعدة البيانات' : 'Database Backup & Integrity'}
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              marginBlockEnd: 'var(--space-4)',
            }}
          >
            {isRtl
              ? 'إنشاء نسخة نقطية متوافقة مع WAL من قاعدة بيانات SQLite المحلية دون إيقاف العمليات.'
              : 'Create a WAL-safe online point-in-time snapshot backup of the local SQLite database.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary touch-btn"
              disabled={backingUp}
              onClick={handleCreateBackup}
            >
              {backingUp
                ? isRtl
                  ? 'جارٍ النسخ...'
                  : 'Backing up...'
                : isRtl
                  ? 'إنشاء نسخة احتياطية فورية'
                  : 'Backup Database Now'}
            </button>
          </div>
        </section>

        {/* Active Session & Security Card */}
        <section className="card" style={{ padding: 'var(--space-4)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBlockEnd: 'var(--space-3)' }}>
            {isRtl ? 'جلسة المستخدم والصلاحيات (RBAC)' : 'User Session & Active Capabilities'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'المستخدم النشط: ' : 'Active User: '}</span>
              <strong>{currentUser?.display_name || 'System Administrator'}</strong> ({currentUser?.username || 'admin'})
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'الأدوار: ' : 'Roles: '}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {currentUser?.roles?.join(', ') || 'ADMIN'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>{isRtl ? 'الصلاحيات النشطة: ' : 'Active Capabilities: '}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                {capabilities.length > 0 ? capabilities.join(' | ') : '*:*.* (Full Administrative Access)'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
