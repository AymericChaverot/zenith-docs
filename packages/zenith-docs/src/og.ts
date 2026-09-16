import { readFile } from 'node:fs/promises';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori from 'satori';
import type { ZenithConfig } from './config';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Dark theme colors, in sRGB. Neither satori nor resvg parses `oklch`, so these
 * mirror the tokens of `styles/theme.css` and have to be updated with them.
 */
const SURFACE = '#09090b';
const TEXT = '#fafafa';
const MUTED = '#a4a4a8';
const BORDER = '#2d2d31';

const ACCENTS: Record<ZenithConfig['accent'], string> = {
  emerald: '#16d584',
  teal: '#00d9cb',
  amber: '#ffaa1c',
  rose: '#ff6889',
  violet: '#a892ff',
  neutral: '#f3f3f5',
};

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
  const [loaded] = await Promise.all([loadFonts(options.assets), loadRenderer(options.assets)]);
  const svg = await satori(card(options) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: loaded,
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
  // Copy the pixels out of the WebAssembly memory, which is reused by the next render.
  return new Uint8Array(png);
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
  const accent = ACCENTS[config.accent];
  const heading = truncate(title, 70);
  const logo = config.logo?.svg ? logoDataUri(config.logo.svg, accent) : undefined;

  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: SURFACE,
      color: TEXT,
      fontFamily: 'Geist',
      // The site anchors its backdrop to the top left, the card does the same.
      backgroundImage: `radial-gradient(circle at 12% 0%, ${rgba(accent, 0.22)}, ${rgba(SURFACE, 0)} 55%)`,
    },
    [
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 8,
        backgroundImage: `linear-gradient(90deg, ${accent}, ${rgba(accent, 0)})`,
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
        },
        [
          el(
            'div',
            { display: 'flex', alignItems: 'center', gap: 18 },
            [
              logo && {
                type: 'img',
                props: { src: logo, width: 44, height: 44, style: { display: 'flex' } },
              },
              title !== config.title &&
                el('div', { fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }, config.title),
            ],
          ),
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
                { fontSize: 30, lineHeight: 1.4, color: MUTED, marginTop: 20 },
                truncate(description, 130),
              ),
          ]),
          el(
            'div',
            { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
            [
              el('div', { display: 'flex', fontSize: 22, color: MUTED }, truncate(section ?? '', 60)),
              el(
                'div',
                { display: 'flex', gap: 12 },
                badges.map((badge) =>
                  el(
                    'div',
                    {
                      display: 'flex',
                      fontSize: 20,
                      color: MUTED,
                      border: `1px solid ${BORDER}`,
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

/** Cut on a word boundary when there is one close enough to the limit. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Inline the logo as a data URI, with `currentColor` resolved and explicit dimensions. */
function logoDataUri(svg: string, color: string): string {
  let markup = svg.replaceAll('currentColor', color);
  if (!/<svg[^>]+\swidth=/.test(markup)) {
    const [, , width = '32', height = '32'] = /viewBox="([^"]+)"/
      .exec(markup)?.[1]
      ?.trim()
      .split(/[\s,]+/) ?? [];
    markup = markup.replace('<svg', `<svg width="${width}" height="${height}"`);
  }
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
}
