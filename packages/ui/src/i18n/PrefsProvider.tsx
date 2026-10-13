import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  dirOf,
  formatDate,
  formatMoney,
  formatNumber,
  translate,
  type CalendarKind,
  type Digits,
  type FormatPrefs,
  type Lang,
  type MessageKey,
} from './index';

export type Theme = 'light' | 'dark';

interface Prefs extends FormatPrefs {
  theme: Theme;
}

interface Ctx extends Prefs {
  dir: 'rtl' | 'ltr';
  t: (k: MessageKey) => string;
  money: (minor: number) => string;
  num: (v: string | number, fd?: number) => string;
  date: (iso: string) => string;
  set: (patch: Partial<Prefs>) => void;
}

const DEFAULTS: Prefs = {
  lang: 'ar',
  theme: 'light',
  digits: 'latn',
  calendar: 'gregory',
  currency: 'SAR',
};
const STORAGE_KEY = 'the-lab.prefs';

function initialPrefs(): Prefs {
  let stored: Partial<Prefs> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    stored = {};
  }
  // URL overrides (used for deterministic screenshots): ?lang=en&theme=dark
  const q = new URLSearchParams(location.search);
  const fromUrl: Partial<Prefs> = {};
  const lang = q.get('lang');
  if (lang === 'ar' || lang === 'en') fromUrl.lang = lang;
  const theme = q.get('theme');
  if (theme === 'light' || theme === 'dark') fromUrl.theme = theme;
  const digits = q.get('digits');
  if (digits === 'latn' || digits === 'arab') fromUrl.digits = digits as Digits;
  const cal = q.get('calendar');
  if (cal === 'gregory' || cal === 'islamic-umalqura') fromUrl.calendar = cal as CalendarKind;
  return { ...DEFAULTS, ...stored, ...fromUrl };
}

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const dir = dirOf(prefs.lang as Lang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = prefs.lang;
    root.dir = dir;
    root.dataset.theme = prefs.theme;
    document.title = translate(prefs.lang, 'app.name');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs, dir]);

  const set = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);

  const value = useMemo<Ctx>(
    () => ({
      ...prefs,
      dir,
      set,
      t: (k) => translate(prefs.lang, k),
      money: (m) => formatMoney(m, prefs),
      num: (v, fd) => formatNumber(v, prefs, fd),
      date: (iso) => formatDate(iso, prefs),
    }),
    [prefs, dir, set],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsContext);
  if (!c) throw new Error('usePrefs outside PrefsProvider');
  return c;
}
