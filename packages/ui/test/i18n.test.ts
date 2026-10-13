import { describe, expect, it } from 'vitest';
import ar from '../src/i18n/ar.json';
import en from '../src/i18n/en.json';
import { dirOf, formatDate, formatMoney, formatNumber, localeTag, type FormatPrefs } from '../src/i18n';
// @ts-expect-error plain ESM script without types
import { checkSource } from '../../../scripts/check-rtl.mjs';

const base: FormatPrefs = { lang: 'ar', digits: 'latn', calendar: 'gregory', currency: 'SAR' };

describe('i18n dictionaries', () => {
  it('ar and en have identical key sets and no empty values', () => {
    const a = Object.keys(ar).sort();
    const e = Object.keys(en).sort();
    expect(a.length).toBeGreaterThan(0);
    expect(e).toEqual(a);
    for (const v of [...Object.values(ar), ...Object.values(en)]) expect(v.trim()).not.toBe('');
  });

  it('direction follows language', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
  });
});

describe('Intl formatting', () => {
  it('builds explicit locale tags', () => {
    expect(localeTag(base)).toBe('ar-SA-u-ca-gregory-nu-latn');
    expect(localeTag({ ...base, digits: 'arab', calendar: 'islamic-umalqura' })).toBe(
      'ar-SA-u-ca-islamic-umalqura-nu-arab',
    );
  });

  it('Western digits by default, Eastern Arabic on request', () => {
    expect(formatNumber(1234, base)).toMatch(/1,?234/);
    expect(formatNumber(1234, { ...base, digits: 'arab' })).toMatch(/١٬?٢٣٤/);
  });

  it('formats integer halalas exactly without float drift', () => {
    expect(formatMoney(1875075, { ...base, lang: 'en' })).toContain('18,750.75');
    expect(formatMoney(1, { ...base, lang: 'en' })).toContain('0.01');
    expect(formatMoney(-250, { ...base, lang: 'en' })).toMatch(/-.*2\.50/);
    // Above 2^53 must still be exact when passed as bigint.
    expect(formatMoney(900719925474099312n, { ...base, lang: 'en' })).toContain('9,007,199,254,740,993.12');
  });

  it('rejects non-integer money', () => {
    expect(() => formatMoney(10.5, base)).toThrow(/integer/);
  });

  it('Hijri calendar differs from Gregorian for the same instant', () => {
    const g = formatDate('2026-10-15T09:00:00Z', { ...base, lang: 'en' });
    const h = formatDate('2026-10-15T09:00:00Z', { ...base, lang: 'en', calendar: 'islamic-umalqura' });
    expect(g).toContain('2026');
    expect(h).not.toContain('2026');
    expect(h).toMatch(/14\d\d/);
  });
});

describe('check-rtl detector', () => {
  it('flags physical properties', () => {
    for (const bad of ['margin-left: 4px;', 'padding-right:0', '  left: 0;', 'text-align: right;', 'border-right: 1px', "style={{ marginLeft: 4 }}", "{ right: '0' }", "textAlign: 'left'"]) {
      expect(checkSource(bad), bad).toHaveLength(1);
    }
  });
  it('allows logical properties', () => {
    for (const ok of ['margin-inline-start: 4px;', 'inset-inline-end: 0;', 'text-align: start;', 'border-inline-start: 1px', 'inlineSize: 4']) {
      expect(checkSource(ok), ok).toHaveLength(0);
    }
  });
});
