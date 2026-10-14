import { useState } from 'react';
import { usePrefs } from '../i18n/PrefsProvider';
import { api } from '../api/client';

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { set, lang, dir } = usePrefs();
  const isRtl = dir === 'rtl';

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedLang, setSelectedLang] = useState<'ar' | 'en'>(lang);
  const [companyNameAr, setCompanyNameAr] = useState('');
  const [companyNameEn, setCompanyNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('SAR');
  const [vatRatePct, setVatRatePct] = useState(15);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNextStep1 = () => {
    set({ lang: selectedLang });
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!companyNameAr.trim() || !companyNameEn.trim()) {
      setErrorMsg(isRtl ? 'يرجى إدخال اسم المنشأة بالعربية والإنجليزية' : 'Please enter company name in Arabic and English');
      return;
    }
    setErrorMsg(null);
    setStep(3);
  };

  const handleNextStep3 = () => {
    if (!adminUsername.trim() || !adminDisplayName.trim() || !adminPassword) {
      setErrorMsg(isRtl ? 'يرجى تعبئة كافة بيانات حساب المسؤول' : 'Please fill all administrator credentials');
      return;
    }
    if (adminPassword.length < 6) {
      setErrorMsg(isRtl ? 'يجب أن تتكون كلمة المرور من 6 خانات على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setErrorMsg(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setErrorMsg(null);
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await api.admin.completeSetup({
        companyNameAr: companyNameAr.trim(),
        companyNameEn: companyNameEn.trim(),
        crNumber: crNumber.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        baseCurrency,
        vatRatePct,
        adminUsername: adminUsername.trim(),
        adminDisplayName: adminDisplayName.trim(),
        adminPassword,
        defaultLanguage: selectedLang,
      });

      // Auto login as the newly created admin
      try {
        await api.auth.login({
          username: adminUsername.trim(),
          password: adminPassword,
        });
      } catch {
        // Fallback gracefully
      }

      onComplete();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to complete initial setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="card"
        style={{
          inlineSize: '100%',
          maxInlineSize: 580,
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBlockEnd: 'var(--space-4)' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBlockEnd: 'var(--space-1)' }}>
            {isRtl ? 'تهيئة المعمل الذكي (الإعداد الأولي)' : 'The Lab — Initial Workspace Setup'}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            {isRtl
              ? `الخطوة ${step} من 4: ${
                  step === 1
                    ? 'اختيار اللغة'
                    : step === 2
                      ? 'بيانات المنشأة'
                      : step === 3
                        ? 'حساب المسؤول'
                        : 'العملة والضريبة'
                }`
              : `Step ${step} of 4: ${
                  step === 1
                    ? 'Select Language'
                    : step === 2
                      ? 'Company Details'
                      : step === 3
                        ? 'Administrator Account'
                        : 'Currency & Tax'
                }`}
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-md)',
              marginBlockEnd: 'var(--space-4)',
              fontWeight: 500,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Language */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
              اختر اللغة الافتراضية لمنصة العمل / Select default system language:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className={`btn touch-btn ${selectedLang === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: 'var(--space-4)', fontSize: '1rem', fontWeight: 600 }}
                onClick={() => setSelectedLang('ar')}
              >
                العربية (RTL)
              </button>
              <button
                type="button"
                className={`btn touch-btn ${selectedLang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: 'var(--space-4)', fontSize: '1rem', fontWeight: 600 }}
                onClick={() => setSelectedLang('en')}
              >
                English (LTR)
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBlockStart: 'var(--space-3)' }}>
              <button type="button" className="btn btn-primary touch-btn" onClick={handleNextStep1}>
                {selectedLang === 'ar' ? 'التالي' : 'Next'} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Company Details */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                {isRtl ? 'اسم المنشأة / المصنع (بالعربية) *' : 'Company Name (Arabic) *'}
              </label>
              <input
                className="input"
                autoFocus
                placeholder={isRtl ? 'مثال: مصنع الأغذية النموذجية' : 'e.g. Model Food Processing'}
                value={companyNameAr}
                onChange={(e) => setCompanyNameAr(e.target.value)}
                style={{ inlineSize: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                {isRtl ? 'اسم المنشأة (بالإنجليزية) *' : 'Company Name (English) *'}
              </label>
              <input
                className="input"
                placeholder={isRtl ? 'مثال: Model Food Factory' : 'e.g. Model Food Processing Factory'}
                value={companyNameEn}
                onChange={(e) => setCompanyNameEn(e.target.value)}
                style={{ inlineSize: '100%' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'رقم السجل التجاري' : 'CR Number'}
                </label>
                <input
                  className="input"
                  placeholder="1010XXXXXX"
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                  style={{ inlineSize: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'الرقم الضريبي (VAT)' : 'VAT Number'}
                </label>
                <input
                  className="input"
                  placeholder="300XXXXXXXXXXXX"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  style={{ inlineSize: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 'var(--space-3)' }}>
              <button type="button" className="btn touch-btn" onClick={() => setStep(1)}>
                {isRtl ? 'السابق' : 'Back'}
              </button>
              <button type="button" className="btn btn-primary touch-btn" onClick={handleNextStep2}>
                {isRtl ? 'التالي' : 'Next'} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Admin Account */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                {isRtl ? 'اسم المستخدم للمسؤول *' : 'Administrator Username *'}
              </label>
              <input
                className="input"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                style={{ inlineSize: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                {isRtl ? 'الاسم الكامل للمسؤول *' : 'Administrator Full Name *'}
              </label>
              <input
                className="input"
                autoFocus
                placeholder={isRtl ? 'مثال: إبراهيم جابر' : 'e.g. System Admin'}
                value={adminDisplayName}
                onChange={(e) => setAdminDisplayName(e.target.value)}
                style={{ inlineSize: '100%' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'كلمة المرور *' : 'Password *'}
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="******"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{ inlineSize: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="******"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  style={{ inlineSize: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 'var(--space-3)' }}>
              <button type="button" className="btn touch-btn" onClick={() => setStep(2)}>
                {isRtl ? 'السابق' : 'Back'}
              </button>
              <button type="button" className="btn btn-primary touch-btn" onClick={handleNextStep3}>
                {isRtl ? 'التالي' : 'Next'} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Currency & Finish */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'العملة الأساسية' : 'Base Currency'}
                </label>
                <select
                  className="input"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  style={{ inlineSize: '100%' }}
                >
                  <option value="SAR">SAR (ر.س - ريال سعودي)</option>
                  <option value="AED">AED (د.إ - درهم إماراتي)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="EGP">EGP (ج.م - جنيه مصري)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBlockEnd: 4 }}>
                  {isRtl ? 'نسبة الضريبة (VAT %)' : 'VAT Rate %'}
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={vatRatePct}
                  onChange={(e) => setVatRatePct(Number(e.target.value))}
                  style={{ inlineSize: '100%' }}
                />
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: 'var(--color-info)',
                fontSize: '0.85rem',
                marginBlock: 'var(--space-2)',
              }}
            >
              {isRtl
                ? 'جاهز لبدء العمل! سيتم إنشاء المنظومة فارغة ونظيفة وجاهزة لإدخال بياناتك الحقيقية.'
                : 'Ready to launch! The system will be initialized clean with zero demo data, ready for your real operations.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 'var(--space-3)' }}>
              <button type="button" className="btn touch-btn" onClick={() => setStep(3)} disabled={submitting}>
                {isRtl ? 'السابق' : 'Back'}
              </button>
              <button
                type="button"
                className="btn btn-primary touch-btn"
                disabled={submitting}
                onClick={handleFinalSubmit}
              >
                {submitting
                  ? isRtl
                    ? 'جارٍ التهيئة...'
                    : 'Initializing...'
                  : isRtl
                    ? 'إتمام التهيئة وبدء الاستخدام'
                    : 'Complete Setup & Launch'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
