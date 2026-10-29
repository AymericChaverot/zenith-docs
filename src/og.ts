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
  /** Geist as WOFF: satori reads TTF, OTF and WOFF, but not WOFF2. */
  fonts: { weight: OgFontWeight; path: string }[];
  /** The resvg WebAssembly binary. */
  wasm: string;
}

export type OgFontWeight = 400 | 600;

let fonts: Promise<{ name: string; weight: OgFontWeight; data: Buffer }[]> | undefined;
let renderer: Promise<unknown> | undefined;

function loadFonts(assets: OgAssets) {
  return (fonts ??= Promise.all(
    assets.fonts.map(async ({ weight, path }) => ({
      name: 'Geist',
      weight,
      data: await readFile(path),
    })),
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
  return satori(card(options) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(options.assets),
  });
}

interface Element {
  type: string;
  props: Record<string, unknown>;
}

type Child = Element | string | false | undefined;

function el(type: string, style: Record<string, unknown>, children?: Child | Child[]): Element {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  return { type, props: { style, ...(list === undefined ? {} : { children: list }) } };
}

function card({ config, title, description, section, badges = [] }: OgImageOptions): Element {
  // Images are only rendered when `og` is on.
  const og = config.og as OgOptions;
  const colors = resolveOgColors(config, og);
  const { accent } = colors;
  const heading = truncate(title, 70);
  const logo = config.logo?.svg ? logoDataUri(config.logo.svg, accent) : undefined;

  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: colors.background,
      color: colors.text,
      fontFamily: 'Geist',
      ...backdrop(og.backdrop, colors),
    },
    [
      og.accentBar &&
        el('div', {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 8,
          backgroundImage: `linear-gradient(90deg, ${accent}, ${toRgba(accent, 0)})`,
        }),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '76px 80px',
          // Satori sizes boxes like CSS, padding included only with `border-box`.
          boxSizing: 'border-box',
        },
        [
          el('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
            logo && {
              type: 'img',
              props: { src: logo, width: 44, height: 44, style: { display: 'flex' } },
            },
            title !== config.title &&
              el('div', { fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }, config.title),
          ]),
          el('div', { display: 'flex', flexDirection: 'column' }, [
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
          ]),
          el(
            'div',
            { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
            [
              el(
                'div',
                { display: 'flex', fontSize: 22, color: colors.muted },
                truncate(section ?? '', 60),
              ),
              el(
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
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/** Background of the card, drawn with the accent so it matches the site. */
function backdrop(name: OgOptions['backdrop'], { accent, background }: OgColors) {
  const faint = toRgba(accent, 0.14);
  // Fades the pattern out towards the bottom right, where the text sits.
  const fade = `radial-gradient(circle at 0% 0%, ${toRgba(background, 0)}, ${background} 75%)`;
  switch (name) {
    case 'glow':
      // The site anchors its backdrop to the top left, the card does the same.
      return {
        backgroundImage: `radial-gradient(circle at 12% 0%, ${toRgba(accent, 0.22)}, ${toRgba(background, 0)} 55%)`,
      };
    case 'grid':
      return {
        backgroundImage: `${fade}, linear-gradient(${faint} 1px, transparent 1px), linear-gradient(90deg, ${faint} 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 48px 48px, 48px 48px',
      };
    case 'dots':
      return {
        // satori reads the stops of a radial gradient as percentages only.
        backgroundImage: `${fade}, radial-gradient(${toRgba(accent, 0.5)} 8%, ${toRgba(accent, 0)} 12%)`,
        backgroundSize: '100% 100%, 24px 24px',
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

/** Inline the logo as a data URI, with `currentColor` resolved and explicit dimensions. */
function logoDataUri(svg: string, color: string): string {
  let markup = svg.replaceAll('currentColor', color);
  if (!/<svg[^>]+\swidth=/.test(markup)) {
    const [, , width = '32', height = '32'] =
      /viewBox="([^"]+)"/
        .exec(markup)?.[1]
        ?.trim()
        .split(/[\s,]+/) ?? [];
    markup = markup.replace('<svg', `<svg width="${width}" height="${height}"`);
  }
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
}
