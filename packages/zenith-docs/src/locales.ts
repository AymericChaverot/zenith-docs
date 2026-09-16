import type { ZenithConfig } from './config';

export interface ResolvedLocale {
  /** Key in the `locales` option, and directory name. `root` means no prefix. */
  key: string;
  label: string;
  /** BCP-47 tag used for the `lang` attribute. */
  lang: string;
  dir: 'ltr' | 'rtl';
  /** URL and directory prefix, `''` for the root locale, `'fr/'` otherwise. */
  prefix: string;
}

export function resolveLocales(config: ZenithConfig): ResolvedLocale[] {
  if (!config.locales) {
    return [{ key: 'root', label: config.lang, lang: config.lang, dir: 'ltr', prefix: '' }];
  }
  return Object.entries(config.locales).map(([key, locale]) => ({
    key,
    label: locale.label,
    lang: locale.lang ?? (key === 'root' ? config.lang : key),
    dir: locale.dir,
    prefix: key === 'root' ? '' : `${key}/`,
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
  const segment = path.split('/')[0];
  const match = locales.find((locale) => locale.key !== 'root' && locale.key === segment);
  return match ?? getDefaultLocale(locales);
}

/**
 * Remove the locale prefix from a content path. The index page of a locale directory has the
 * locale itself as its id, so `fr` becomes `index`.
 */
export function stripLocale(path: string, locale: ResolvedLocale): string {
  if (!locale.prefix) return path;
  if (path === locale.key) return 'index';
  return path.startsWith(locale.prefix) ? path.slice(locale.prefix.length) : path;
}
