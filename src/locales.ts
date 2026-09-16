import type { ZenithConfig } from './config';
import { resolvePrefix, segmentOf, stripSegment, type PrefixedSegment } from './prefixes';

export interface ResolvedLocale extends PrefixedSegment {
  label: string;
  /** BCP-47 tag used for the `lang` attribute. */
  lang: string;
  dir: 'ltr' | 'rtl';
}

export function resolveLocales(config: Pick<ZenithConfig, 'lang' | 'locales'>): ResolvedLocale[] {
  if (!config.locales) {
    return [{ key: 'root', label: config.lang, lang: config.lang, dir: 'ltr', prefix: '' }];
  }
  return Object.entries(config.locales).map(([key, locale]) => ({
    key,
    label: locale.label,
    lang: locale.lang ?? (key === 'root' ? config.lang : key),
    dir: locale.dir,
    prefix: resolvePrefix(key),
  }));
}

export function getDefaultLocale(locales: ResolvedLocale[]): ResolvedLocale {
  return locales.find((locale) => locale.key === 'root') ?? locales[0]!;
}

export function getLocale(locales: ResolvedLocale[], key: string): ResolvedLocale {
  return locales.find((locale) => locale.key === key) ?? getDefaultLocale(locales);
}

/** The locale a content path belongs to, based on its first segment. */
export function localeOf(path: string, locales: ResolvedLocale[]): ResolvedLocale {
  return segmentOf(path, locales, getDefaultLocale(locales));
}

/** Remove the locale prefix from a content path. */
export function stripLocale(path: string, locale: ResolvedLocale): string {
  return stripSegment(path, locale);
}
