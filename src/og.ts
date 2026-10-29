import { readFile } from 'node:fs/promises';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori from 'satori';
import { PALETTE, resolveAccent, toHex, toRgba } from './colors';
import type { OgOptions, ZenithConfig } from './config';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Colors of a card, in sRGB: neither satori nor resvg parses `oklch`. */
export interface OgColors {
  background: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

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

/** An image placed on the card, as a data URI. */
export interface OgImage {
  src: string;
  width: number;
  height: number;
}

/** What a template draws, with the options of the site already applied. */
export interface OgTemplateProps {
  title: string;
  /** Left out when the page has none, or `description` is off. */
  description?: string;
  /** Breadcrumb trail, left out when `breadcrumb` is off. */
  section?: string;
  /** Language and version, empty when `badges` is off. */
  badges: string[];
  /** Left out on the home page, whose title is already the site name, or when `siteName` is off. */
  siteName?: string;
  logo?: OgImage;
  /** Image covering the card, from the `background` option. */
  background?: OgImage;
  colors: OgColors;
  /** Family of the `font` option, or Geist. */
  fontFamily: string;
  options: OgOptions;
  width: number;
  height: number;
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

/** A node of the card, as satori reads it. */
export interface OgNode {
  type: string;
  props: Record<string, unknown>;
}

export type OgChild = OgNode | string | number | false | null | undefined | OgChild[];

/**
 * Builds a node, with the signature of a JSX factory: `h('div', { style }, 'Text')`.
 * Falsy children are dropped, so `cond && h(…)` works.
 */
export function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: OgChild[]
): OgNode {
  const list: (OgNode | string | number)[] = [];
  const add = (child: OgChild): void => {
    if (Array.isArray(child)) child.forEach(add);
    else if (child !== false && child !== null && child !== undefined) list.push(child);
  };
  children.forEach(add);
  return {
    type,
    props: {
      ...props,
      ...(list.length === 0 ? {} : { children: list.length === 1 ? list[0] : list }),
    },
  };
}

function el(type: string, style: Record<string, unknown>, ...children: OgChild[]): OgNode {
  return h(type, { style }, ...children);
}

/** The built-in card, in the layout chosen by the `layout` option. */
export function defaultTemplate(props: OgTemplateProps): OgNode {
  const { colors, options } = props;
  const layout = { default: defaultLayout, centered: centeredLayout, split: splitLayout }[
    options.layout
  ];
  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: colors.background,
      color: colors.text,
      fontFamily: props.fontFamily,
    },
    props.background &&
      h('img', {
        src: props.background.src,
        width: props.width,
        height: props.height,
        style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' },
      }),
    el('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      ...backdrop(options.backdrop, colors),
    }),
    options.accentBar &&
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 8,
        backgroundImage: `linear-gradient(90deg, ${colors.accent}, ${toRgba(colors.accent, 0)})`,
      }),
    // Positioned, like the layers above, so it is painted after them.
    el(
      'div',
      { display: 'flex', position: 'relative', width: '100%', height: '100%' },
      layout(props),
    ),
  );
}

/** Three rows spread over the card: a header, the text and a footer. */
function rows(top: OgChild, middle: OgChild, bottom: OgChild, align = 'stretch'): OgNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: align,
      width: '100%',
      height: '100%',
      padding: '76px 80px',
      // Satori sizes boxes like CSS, padding included only with `border-box`.
      boxSizing: 'border-box',
    },
    // Empty rows keep their place, so the text stays where the layout puts it.
    el('div', { display: 'flex', alignItems: 'center', gap: 24 }, top),
    middle,
    el('div', { display: 'flex', alignItems: 'center', gap: 24 }, bottom),
  );
}

/** Two ends of a row, pushed apart. */
function ends(left: OgChild, right: OgChild): OgNode {
  return el(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flex: 1 },
    el('div', { display: 'flex', alignItems: 'center' }, left),
    el('div', { display: 'flex', alignItems: 'center' }, right),
  );
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The brand in its corner; the breadcrumb and badges at the bottom, or above when it is there. */
function defaultLayout(props: OgTemplateProps): OgNode {
  const position = brandPosition(props);
  const corners: Partial<Record<Corner, OgChild>> = { [position]: brand(props) };
  const free = (side: 'left' | 'right'): Corner =>
    position === `bottom-${side}` ? `top-${side}` : `bottom-${side}`;
  corners[free('left')] = section(props);
  corners[free('right')] = badges(props);

  return rows(
    ends(corners['top-left'], corners['top-right']),
    text(props, 'left'),
    ends(corners['bottom-left'], corners['bottom-right']),
  );
}

/** Everything on the center line, with the brand above or below the text. */
function centeredLayout(props: OgTemplateProps): OgNode {
  const top = brandPosition(props).startsWith('top');
  const meta = el(
    'div',
    { display: 'flex', alignItems: 'center', gap: 24 },
    section(props),
    badges(props),
  );
  return rows(
    top ? brand(props) : meta,
    text(props, 'center'),
    top ? meta : brand(props),
    'center',
  );
}

/** The text on the left, the logo drawn large on the right. */
function splitLayout(props: OgTemplateProps): OgNode {
  const { logo, siteName } = props;
  const top = brandPosition(props).startsWith('top');
  const name = siteName && el('div', SITE_NAME_STYLE, siteName);
  const meta = ends(section(props), badges(props));
  return el(
    'div',
    { display: 'flex', width: '100%', height: '100%' },
    el(
      'div',
      { display: 'flex', flex: 1 },
      rows(top ? name : meta, text(props, 'left'), top ? meta : name),
    ),
    logo &&
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 400,
          height: '100%',
          paddingRight: 80,
        },
        image(scale(logo, 240)),
      ),
  );
}

function brandPosition({ options }: OgTemplateProps): Corner {
  return options.logo ? options.logo.position : 'top-left';
}

const SITE_NAME_STYLE = { fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' };

function brand({ logo, siteName }: OgTemplateProps): OgChild {
  if (!logo && !siteName) return undefined;
  return el(
    'div',
    { display: 'flex', alignItems: 'center', gap: 18 },
    logo && image(logo),
    siteName && el('div', SITE_NAME_STYLE, siteName),
  );
}

function text({ title, description, colors }: OgTemplateProps, align: 'left' | 'center'): OgNode {
  const heading = truncate(title, 70);
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      textAlign: align,
    },
    el(
      'div',
      {
        fontSize: heading.length > 40 ? 58 : 70,
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: '-0.035em',
      },
      heading,
    ),
    description &&
      el(
        'div',
        { fontSize: 30, lineHeight: 1.4, color: colors.muted, marginTop: 20 },
        truncate(description, 130),
      ),
  );
}

function section({ section, colors }: OgTemplateProps): OgChild {
  return (
    section &&
    el('div', { display: 'flex', fontSize: 22, color: colors.muted }, truncate(section, 60))
  );
}

function badges({ badges, colors }: OgTemplateProps): OgChild {
  if (badges.length === 0) return undefined;
  return el(
    'div',
    { display: 'flex', gap: 12 },
    badges.map((badge) =>
      el(
        'div',
        {
          display: 'flex',
          fontSize: 20,
          color: colors.muted,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: '8px 18px',
        },
        badge,
      ),
    ),
  );
}

function image({ src, width, height }: OgImage): OgNode {
  return h('img', { src, width, height, style: { display: 'flex' } });
}

/** The same image at another height, in proportion. */
function scale(image: OgImage, height: number): OgImage {
  return { ...image, width: Math.round((image.width / image.height) * height), height };
}

/** Background of the card, drawn with the accent so it matches the site. */
function backdrop(name: OgOptions['backdrop'], { accent, background }: OgColors) {
  const faint = toRgba(accent, 0.14);
  // Fades the pattern out towards the bottom right, where the text sits, and lets a
  // background image show through.
  const fade = 'radial-gradient(circle at 0% 0%, black, transparent 75%)';
  switch (name) {
    case 'glow':
      // The site anchors its backdrop to the top left, the card does the same.
      return {
        backgroundImage: `radial-gradient(circle at 12% 0%, ${toRgba(accent, 0.22)}, ${toRgba(background, 0)} 55%)`,
      };
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${faint} 1px, transparent 1px), linear-gradient(90deg, ${faint} 1px, transparent 1px)`,
        backgroundSize: '48px 48px, 48px 48px',
        maskImage: fade,
      };
    case 'dots':
      return {
        // satori reads the stops of a radial gradient as percentages only.
        backgroundImage: `radial-gradient(${toRgba(accent, 0.5)} 8%, ${toRgba(accent, 0)} 12%)`,
        backgroundSize: '24px 24px',
        maskImage: fade,
      };
    case 'none':
      return {};
  }
}

/** Cut on a word boundary when there is one close enough to the limit. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
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
