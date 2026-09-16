import { existsSync, readFileSync } from 'node:fs';
import type { ZenithConfig } from './config';

type Logo = NonNullable<ZenithConfig['logo']>;

/** Inline SVG logos so they can inherit the text color. Other formats stay as public URLs. */
export function resolveLogo(
  logo: Logo | undefined,
  { root, publicDir }: { root: URL; publicDir: URL },
): Logo | undefined {
  if (!logo || !logo.src.endsWith('.svg')) return logo;

  const file = logo.src.startsWith('.')
    ? new URL(logo.src, root)
    : logo.src.startsWith('/')
      ? new URL(`.${logo.src}`, publicDir)
      : undefined;
  if (!file || !existsSync(file)) return logo;

  const svg = readFileSync(file, 'utf8')
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return { ...logo, svg };
}
