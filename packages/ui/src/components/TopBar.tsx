import { usePrefs } from '../i18n/PrefsProvider';
import type { MessageKey } from '../i18n';
import { ChevronForward, IconMenu, IconMoon, IconSun } from './icons';

export function TopBar({ current, onToggleSidebar }: { current: MessageKey; onToggleSidebar: () => void }) {
  const { t, theme, lang, digits, calendar, set } = usePrefs();
  return (
    <header className="topbar">
      <button type="button" className="btn btn-icon" aria-label={t('top.toggleSidebar')} onClick={onToggleSidebar}>
        <IconMenu />
      </button>
      <nav className="breadcrumb" aria-label={t('breadcrumb.label')}>
        <span>{t('app.name')}</span>
        <ChevronForward />
        <span aria-current="page">{t(current)}</span>
      </nav>
      <div className="topbar-spacer" />
      <label className="control">
        {t('top.digits')}
        <select className="select" value={digits} onChange={(e) => set({ digits: e.target.value as 'latn' | 'arab' })}>
          <option value="latn">{t('top.digits.latn')}</option>
          <option value="arab">{t('top.digits.arab')}</option>
        </select>
      </label>
      <label className="control">
        {t('top.calendar')}
        <select
          className="select"
          value={calendar}
          onChange={(e) => set({ calendar: e.target.value as 'gregory' | 'islamic-umalqura' })}
        >
          <option value="gregory">{t('top.calendar.gregory')}</option>
          <option value="islamic-umalqura">{t('top.calendar.islamic')}</option>
        </select>
      </label>
      <label className="control">
        {t('top.language')}
        <select className="select" value={lang} onChange={(e) => set({ lang: e.target.value as 'ar' | 'en' })}>
          {/* Language names are shown in their own language by convention (same value in both dictionaries). */}
          <option value="ar" lang="ar">
            {t('lang.ar')}
          </option>
          <option value="en" lang="en">
            {t('lang.en')}
          </option>
        </select>
      </label>
      <button
        type="button"
        className="btn"
        aria-label={t('top.theme')}
        onClick={() => set({ theme: theme === 'light' ? 'dark' : 'light' })}
      >
        {theme === 'light' ? <IconMoon /> : <IconSun />}
        <span>{t(theme === 'light' ? 'top.theme.dark' : 'top.theme.light')}</span>
      </button>
    </header>
  );
}
