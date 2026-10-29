import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { PALETTE, resolveAccent, toHex } from '../src/colors';
import { ZenithConfigSchema, type OgOptions, type ZenithConfig } from '../src/config';
import { OG_HEIGHT, OG_WIDTH, renderOgSvg, resolveOgColors, type OgAssets } from '../src/og';
import { h } from '../src/og-template';

const require = createRequire(import.meta.url);

const assets: OgAssets = {
  fonts: ([400, 600] as const).map((weight) => ({
    name: 'Geist',
    style: 'normal' as const,
    weight,
    path: require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`),
  })),
  wasm: require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
};

const config = { ...ZenithConfigSchema.parse({}), favicon: '/favicon.svg' } as ZenithConfig;

/** Boxes drawn with a border, such as the badges, as satori lays them out. */
function borderedBoxes(svg: string) {
  return [
    ...svg.matchAll(
      /<path width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#2d2d31"[^>]*d="M([\d.]+),([\d.]+)/g,
    ),
  ].map(([, width, height, x, y]) => ({
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  }));
}

describe('renderOgSvg', () => {
  it('keeps the badges inside the card', async () => {
    const svg = await renderOgSvg({
      config,
      assets,
      title: 'Getting started',
      description: 'Run a documentation site from a config file and a folder of Markdown.',
      section: 'Guides',
      badges: ['English', 'v2'],
    });

    const boxes = borderedBoxes(svg);
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.x + box.width).toBeLessThanOrEqual(OG_WIDTH);
      expect(box.y + box.height).toBeLessThanOrEqual(OG_HEIGHT);
      // The bottom row sits in the lower part of the card, above its padding.
      expect(box.y).toBeGreaterThan(OG_HEIGHT / 2);
    }
  });
});

describe('og options', () => {
  const render = (og: unknown) =>
    renderOgSvg({
      config: { ...ZenithConfigSchema.parse({ og }), favicon: '' } as ZenithConfig,
      assets,
      title: 'Getting started',
      badges: ['English', 'v2'],
    });

  it('leaves out what is turned off', async () => {
    expect(borderedBoxes(await render({ badges: false }))).toHaveLength(0);
  });

  it('moves the badges up when the brand takes their corner', async () => {
    for (const layout of ['default', 'centered', 'split']) {
      const boxes = borderedBoxes(
        await render({ layout, logo: { position: 'bottom-right' }, colorScheme: 'dark' }),
      );
      expect(boxes).toHaveLength(2);
      expect(boxes[0]!.y).toBeLessThan(OG_HEIGHT / 2);
    }
  });
});

describe('templates', () => {
  it('draw the card instead of the built-in one', async () => {
    const svg = await renderOgSvg({
      config,
      assets,
      title: 'Getting started',
      url: '/guides/',
      lang: 'fr',
      template: ({ url, lang, colors }) =>
        h(
          'div',
          { style: { display: 'flex', width: '100%', background: colors.accent } },
          url,
          lang,
        ),
    });
    expect(svg).toContain(`fill="${toHex(resolveAccent('emerald').dark)}"`);
    expect(borderedBoxes(svg)).toHaveLength(0);
  });
});

describe('resolveOgColors', () => {
  const parse = (og: unknown) =>
    ({ ...ZenithConfigSchema.parse({ og }), favicon: '' }) as ZenithConfig;

  it('takes the dark palette and the accent of the site by default', () => {
    const site = parse(true);
    expect(resolveOgColors(site, site.og as OgOptions)).toEqual({
      background: toHex(PALETTE.dark.background),
      text: toHex(PALETTE.dark.text),
      muted: toHex(PALETTE.dark.text2),
      accent: toHex(resolveAccent('emerald').dark),
      border: toHex(PALETTE.dark.borderStrong),
    });
  });

  it('follows the color scheme, then the overrides', () => {
    const site = parse({ colorScheme: 'light', colors: { accent: '#f60', background: '#fafafa' } });
    const colors = resolveOgColors(site, site.og as OgOptions);
    expect(colors.text).toBe(toHex(PALETTE.light.text));
    expect(colors.accent).toBe('#ff6600');
    expect(colors.background).toBe('#fafafa');
  });
});
