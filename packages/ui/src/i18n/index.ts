import ar from './ar.json';
import en from './en.json';

export type Lang = 'ar' | 'en';
export type Digits = 'latn' | 'arab';
export type CalendarKind = 'gregory' | 'islamic-umalqura';
export type MessageKey = keyof typeof ar;

export const dictionaries: Record<Lang, Record<MessageKey, string>> = { ar, en };

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

export function translate(lang: Lang, key: MessageKey): string {
  return dictionaries[lang][key] ?? dictionaries.ar[key] ?? key;
}

export interface FormatPrefs {
  lang: Lang;
  digits: Digits;
  calendar: CalendarKind;
  currency: string;
}

/** BCP-47 locale with explicit numbering system and calendar extensions. */
export function localeTag(p: Pick<FormatPrefs, 'lang' | 'digits' | 'calendar'>): string {
  const base = p.lang === 'ar' ? 'ar-SA' : 'en-US';
  const cal = p.calendar === 'gregory' ? 'gregory' : 'islamic-umalqura';
  return `${base}-u-ca-${cal}-nu-${p.digits}`;
}

/** Money is passed as integer minor units (halalas); never as a float. */
export function formatMoney(minor: number | bigint, p: FormatPrefs): string {
  const v = typeof minor === 'bigint' ? minor : BigInt(minor);
  if (typeof minor === 'number' && !Number.isSafeInteger(minor)) {
    throw new Error('formatMoney expects integer minor units');
  }
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const major = abs / 100n;
  const frac = abs % 100n;
  // Format via string to avoid float conversion of the stored value.
  const fmt = new Intl.NumberFormat(localeTag(p), {
    style: 'currency',
    currency: p.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const decimal = `${neg ? '-' : ''}${major}.${frac.toString().padStart(2, '0')}`;
  return fmt.format(decimal as unknown as number);
}

export function formatNumber(value: string | number, p: FormatPrefs, fractionDigits = 0): string {
  return new Intl.NumberFormat(localeTag(p), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value as number);
}

export function formatDate(iso: string, p: FormatPrefs): string {
  return new Intl.DateTimeFormat(localeTag(p), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(iso));
}
