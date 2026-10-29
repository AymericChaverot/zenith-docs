import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ZenithConfigSchema, type ZenithConfig } from '../src/config';
import { OG_HEIGHT, OG_WIDTH, renderOgSvg, type OgAssets } from '../src/og';

const require = createRequire(import.meta.url);

const assets: OgAssets = {
  fonts: ([400, 600] as const).map((weight) => ({
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
