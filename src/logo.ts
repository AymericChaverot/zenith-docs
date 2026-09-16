import { existsSync, readFileSync } from 'node:fs';
import type { ZenithLogo, ZenithParsedConfig } from './config';

/** Assets ZenithDocs falls back to when a project brings none of its own. */
export const DEFAULT_LOGO = new URL('./assets/logo.svg', import.meta.url);
export const DEFAULT_FAVICON = new URL('./assets/favicon.svg', import.meta.url);

/** Path the default favicon is served at, when the project has none. */
export const DEFAULT_FAVICON_PATH = '/favicon.svg';

function readSvg(file: URL): string {
  return readFileSync(file, 'utf8')
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

/**
 * Inline SVG logos so they can inherit the text color. Other formats stay as public URLs.
 * No logo means the ZenithDocs one, `false` means none at all.
 */
export function resolveLogo(
  logo: ZenithParsedConfig['logo'],
  { root, publicDir }: { root: URL; publicDir: URL },
): ZenithLogo | undefined {
  if (logo === false) return undefined;
  if (!logo) {
    return { src: '', alt: 'ZenithDocs', replacesTitle: false, svg: readSvg(DEFAULT_LOGO) };
  }
  if (!logo.src.endsWith('.svg')) return logo;

  const file = logo.src.startsWith('.')
    ? new URL(logo.src, root)
    : logo.src.startsWith('/')
      ? new URL(`.${logo.src}`, publicDir)
      : undefined;
  if (!file || !existsSync(file)) return logo;

  return { ...logo, svg: readSvg(file) };
}

/**
 * The favicon URL, and whether ZenithDocs has to serve its own: only when the option
 * is unset and the project has no `public/favicon.svg`.
 */
export function resolveFavicon(
  favicon: string | undefined,
  { publicDir }: { publicDir: URL },
): { favicon: string; serveDefault: boolean } {
  if (favicon) return { favicon, serveDefault: false };
  const own = existsSync(new URL(`.${DEFAULT_FAVICON_PATH}`, publicDir));
  return { favicon: DEFAULT_FAVICON_PATH, serveDefault: !own };
}
