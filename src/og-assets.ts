import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AstroError } from 'astro/errors';
import type { OgOptions, ZenithConfig } from './config';
import type { OgAssets, OgFontWeight } from './og';

const require = createRequire(import.meta.url);

/** Font weights embedded in Open Graph images, see `og.ts`. */
const OG_FONT_WEIGHTS: OgFontWeight[] = [400, 600];

/** Image formats satori can draw. */
const IMAGE_TYPES = ['.svg', '.png', '.jpg', '.jpeg'];

/**
 * Files read while rendering Open Graph images, as absolute paths. They are resolved
 * when the integration starts, because the route is bundled and loses package names.
 */
export function resolveOgAssets(
  config: ZenithConfig,
  og: OgOptions,
  { root, publicDir }: { root: URL; publicDir: URL },
): OgAssets {
  const locate = (path: string) =>
    path.startsWith('/') ? new URL(`.${path}`, publicDir) : new URL(path, root);
  const isImage = (path: string) => IMAGE_TYPES.includes(extname(path).toLowerCase());

  const file = (option: string, path: string) => {
    const url = locate(path);
    if (!existsSync(url)) throw new AstroError(`Cannot find the file of \`${option}\`: ${path}`);
    if (!isImage(path)) {
      throw new AstroError(`\`${option}\` must be an SVG, PNG or JPEG image: ${path}`);
    }
    return fileURLToPath(url);
  };

  // The logo of the site is inlined when it is an SVG. Other formats are read from disk
  // when they can be, and left off the card otherwise, such as a remote URL.
  const siteLogo = () => {
    const src = config.logo && !config.logo.svg ? config.logo.src : undefined;
    if (!src || !/^[./]/.test(src) || !isImage(src) || !existsSync(locate(src))) return undefined;
    return fileURLToPath(locate(src));
  };

  return {
    fonts: OG_FONT_WEIGHTS.map((weight) => ({
      weight,
      path: require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`),
    })),
    wasm: require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
    logo: og.logo ? (og.logo.src ? file('og.logo.src', og.logo.src) : siteLogo()) : undefined,
    background: og.background ? file('og.background', og.background) : undefined,
  };
}
