import { readFile } from 'node:fs/promises';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori from 'satori';
import { PALETTE, resolveAccent, toHex } from './colors';
import type { OgOptions, ZenithConfig } from './config';
import { defaultTemplate, type OgColors, type OgImage, type OgTemplateProps } from './og-template';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The palette of the chosen color scheme, the accent of the site, then the overrides. */
export function resolveOgColors(config: ZenithConfig, og: OgOptions): OgColors {
  const scheme = og.colorScheme;
  const palette = PALETTE[scheme];
  const base = {
    background: palette.background,
    text: palette.text,
    muted: palette.text2,
    accent: resolveAccent(config.accent)[scheme],
    border: scheme === 'dark' ? PALETTE.dark.borderStrong : PALETTE.light.border,
  };
  const colors = { ...base, ...og.colors };
  return {
    background: toHex(colors.background),
    text: toHex(colors.text),
    muted: toHex(colors.muted),
    accent: toHex(colors.accent),
    border: toHex(colors.border),
  };
}

/**
 * Files read at render time. Their paths are resolved when the integration starts,
 * because this module is bundled and can no longer resolve packages by name.
 */
export interface OgAssets {
  /**
   * Font files, the ones of the `font` option first, then Geist as a fallback for the
   * characters they lack. satori reads TTF, OTF and WOFF, but not WOFF2.
   */
  fonts: OgFontFile[];
  /** The resvg WebAssembly binary. */
  wasm: string;
  /** The logo, when it is not an SVG inlined in the config. */
  logo?: string;
  /** Image covering the card. */
  background?: string;
}

export type OgFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface OgFontFile {
  name: string;
  weight: OgFontWeight;
  style: 'normal' | 'italic';
  path: string;
}

let fonts: Promise<(Omit<OgFontFile, 'path'> & { data: Buffer })[]> | undefined;
let renderer: Promise<unknown> | undefined;

function loadFonts(assets: OgAssets) {
  return (fonts ??= Promise.all(
    assets.fonts.map(async ({ path, ...font }) => ({ ...font, data: await readFile(path) })),
  ));
}

function loadRenderer(assets: OgAssets) {
  return (renderer ??= readFile(assets.wasm).then((wasm) => initWasm(wasm)));
}

export interface OgImageOptions {
  config: ZenithConfig;
  assets: OgAssets;
  title: string;
  description?: string;
  /** Breadcrumb trail shown at the bottom of the card. */
  section?: string;
  /** Small pills, such as the language and the version. */
  badges?: string[];
}

export async function renderOgImage(options: OgImageOptions): Promise<Uint8Array<ArrayBuffer>> {
  const [svg] = await Promise.all([renderOgSvg(options), loadRenderer(options.assets)]);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
  // Copy the pixels out of the WebAssembly memory, which is reused by the next render.
  return new Uint8Array(png);
}

/** The card as SVG, before it is rasterized. */
export async function renderOgSvg(options: OgImageOptions): Promise<string> {
  return satori(defaultTemplate(await templateProps(options)) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(options.assets),
  });
}

async function templateProps({
  config,
  assets,
  title,
  description,
  section,
  badges = [],
}: OgImageOptions): Promise<OgTemplateProps> {
  // Images are only rendered when `og` is on.
  const options = config.og as OgOptions;
  const colors = resolveOgColors(config, options);
  const name = typeof options.siteName === 'string' ? options.siteName : config.title;
  const size = options.logo ? options.logo.size : 0;
  const logo = assets.logo
    ? await loadImage(assets.logo, colors.accent, size)
    : options.logo && config.logo?.svg
      ? svgImage(config.logo.svg, colors.accent, size)
      : undefined;
  return {
    title,
    description: options.description ? description : undefined,
    section: options.breadcrumb ? section : undefined,
    badges: options.badges ? badges : [],
    siteName: options.siteName && name !== title ? name : undefined,
    logo,
    background: assets.background
      ? await loadImage(assets.background, colors.accent, OG_HEIGHT)
      : undefined,
    colors,
    fontFamily: assets.fonts[0]!.name,
    options,
    width: OG_WIDTH,
    height: OG_HEIGHT,
  };
}

const images = new Map<string, Promise<Buffer>>();

/** An image file `height` pixels high, in proportion. The file is read once per build. */
async function loadImage(path: string, color: string, height: number): Promise<OgImage> {
  let data = images.get(path);
  if (!data) images.set(path, (data = readFile(path)));
  const bytes = await data;
  if (/\.svg$/i.test(path)) return svgImage(bytes.toString('utf8'), color, height);

  const png = /\.png$/i.test(path);
  const [width, ratioHeight] = png ? pngSize(bytes) : jpegSize(bytes);
  return {
    src: `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`,
    width: Math.round((width / ratioHeight) * height),
    height,
  };
}

/** Dimensions from the IHDR chunk, which always comes first. */
function pngSize(bytes: Buffer): [number, number] {
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/** Dimensions from the first start-of-frame marker. */
function jpegSize(bytes: Buffer): [number, number] {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    const marker = bytes[offset + 1]!;
    // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('Cannot read the dimensions of a JPEG image.');
}

/** An SVG logo `height` pixels high, in proportion, with `currentColor` resolved. */
export function svgImage(svg: string, color: string, height: number): OgImage {
  const [width, ratioHeight] = svgSize(svg);
  // satori needs explicit dimensions on the root element.
  const markup = svg
    .replaceAll('currentColor', color)
    .replace(/<svg\b[^>]*>/, (tag) =>
      tag
        .replace(/\s(?:width|height)="[^"]*"/g, '')
        .replace('<svg', `<svg width="${width}" height="${ratioHeight}"`),
    );
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`,
    width: Math.round((width / ratioHeight) * height),
    height,
  };
}

/** Width and height of an SVG, from its attributes or its `viewBox`. */
function svgSize(svg: string): [number, number] {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const attr = (name: string) =>
    Number.parseFloat(new RegExp(`\\s${name}="([\\d.]+)`).exec(root)?.[1] ?? '');
  const [, , boxWidth, boxHeight] = (/viewBox="([^"]+)"/.exec(root)?.[1] ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = attr('width') || boxWidth || 32;
  const height = attr('height') || boxHeight || 32;
  return [width, height];
}
