import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AstroError } from 'astro/errors';
import type { OgOptions, ZenithConfig } from './config';
import type { OgAssets, OgFontFile, OgFontWeight } from './og';

const require = createRequire(import.meta.url);

/** Weights of Geist embedded in Open Graph images, see `og.ts`. */
const OG_FONT_WEIGHTS: OgFontWeight[] = [400, 600];

/** File formats satori can read, and how to name them in an error. */
const IMAGE_TYPES = {
  extensions: ['.svg', '.png', '.jpg', '.jpeg'],
  name: 'an SVG, PNG or JPEG image',
};
const FONT_TYPES = { extensions: ['.ttf', '.otf', '.woff'], name: 'a TTF, OTF or WOFF font' };

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
  const isImage = (path: string) => IMAGE_TYPES.extensions.includes(extname(path).toLowerCase());

  const file = (option: string, path: string, types = IMAGE_TYPES) => {
    const url = locate(path);
    if (!existsSync(url)) throw new AstroError(`Cannot find the file of \`${option}\`: ${path}`);
    if (!types.extensions.includes(extname(path).toLowerCase())) {
      throw new AstroError(`\`${option}\` must be ${types.name}: ${path}`);
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

  const own: OgFontFile[] = (og.font?.files ?? []).map(({ path, weight, style }) => ({
    name: og.font!.name,
    weight: weight as OgFontWeight,
    style,
    path: file('og.font', path, FONT_TYPES),
  }));
  const geist: OgFontFile[] = OG_FONT_WEIGHTS.map((weight) => ({
    name: 'Geist',
    weight,
    style: 'normal',
    path: require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`),
  }));

  return {
    fonts: [...own, ...geist],
    wasm: require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
    logo: og.logo ? (og.logo.src ? file('og.logo.src', og.logo.src) : siteLogo()) : undefined,
    background: og.background ? file('og.background', og.background) : undefined,
  };
}
