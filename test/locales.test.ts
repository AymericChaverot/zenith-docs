import { describe, expect, it } from 'vitest';
import {
  getDefaultLocale,
  localeOf,
  resolveLocales,
  stripLocale,
  type ResolvedLocale,
} from '../src/locales';
import { getTranslations } from '../src/translations';
import type { ZenithConfig } from '../src/config';

const config = (locales?: ZenithConfig['locales']) =>
  ({ lang: 'en', locales }) as unknown as ZenithConfig;

describe('resolveLocales', () => {
  it('falls back to a single root locale', () => {
    expect(resolveLocales(config())).toEqual([
      { key: 'root', label: 'en', lang: 'en', dir: 'ltr', prefix: '' },
    ]);
  });

  it('resolves prefixes, languages and labels', () => {
    const locales = resolveLocales(
      config({
        root: { label: 'English', dir: 'ltr' },
        fr: { label: 'Français', dir: 'ltr' },
        ar: { label: 'العربية', lang: 'ar-EG', dir: 'rtl' },
      }),
    );
    expect(locales).toEqual([
      { key: 'root', label: 'English', lang: 'en', dir: 'ltr', prefix: '' },
      { key: 'fr', label: 'Français', lang: 'fr', dir: 'ltr', prefix: 'fr/' },
      { key: 'ar', label: 'العربية', lang: 'ar-EG', dir: 'rtl', prefix: 'ar/' },
    ]);
    expect(getDefaultLocale(locales).key).toBe('root');
  });
});

describe('paths', () => {
  const locales: ResolvedLocale[] = resolveLocales(
    config({ root: { label: 'English', dir: 'ltr' }, fr: { label: 'Français', dir: 'ltr' } }),
  );
  const fr = locales[1]!;

  it('detects the locale of a path', () => {
    expect(localeOf('fr/guides/intro', locales).key).toBe('fr');
    expect(localeOf('guides/intro', locales).key).toBe('root');
    expect(localeOf('french/intro', locales).key).toBe('root');
  });

  it('strips the locale prefix', () => {
    expect(stripLocale('fr/guides/intro', fr)).toBe('guides/intro');
    expect(stripLocale('guides/intro', locales[0]!)).toBe('guides/intro');
  });

  it('treats the locale directory itself as its index page', () => {
    expect(stripLocale('fr', fr)).toBe('index');
    expect(stripLocale('fr/index.mdx', fr)).toBe('index.mdx');
  });
});

describe('getTranslations', () => {
  it('uses the built-in strings of the language subtag', () => {
    expect(getTranslations('fr-CA')['toc.title']).toBe('Sur cette page');
    expect(getTranslations('en')['toc.title']).toBe('On this page');
  });

  it('falls back to English for unknown languages', () => {
    expect(getTranslations('nl')['page.next']).toBe('Next');
  });

  it('applies overrides', () => {
    expect(getTranslations('fr', { 'toc.title': 'Sommaire' })['toc.title']).toBe('Sommaire');
  });
});
