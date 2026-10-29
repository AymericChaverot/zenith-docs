import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ZenithConfigSchema, type OgOptions, type ZenithConfig } from '../src/config';
import { resolveOgAssets } from '../src/og-assets';

const dir = mkdtempSync(join(tmpdir(), 'zenith-og-'));
mkdirSync(join(dir, 'public'));
mkdirSync(join(dir, 'src'));
writeFileSync(join(dir, 'public', 'logo.png'), '');
writeFileSync(join(dir, 'src', 'card.svg'), '<svg/>');
writeFileSync(join(dir, 'src', 'card.webp'), '');
writeFileSync(join(dir, 'src', 'serif.ttf'), '');
writeFileSync(join(dir, 'src', 'serif.woff2'), '');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const paths = { root: pathToFileURL(`${dir}/`), publicDir: pathToFileURL(`${dir}/public/`) };

function resolve(options: Record<string, unknown>) {
  const parsed = ZenithConfigSchema.parse(options);
  const config = { ...parsed, favicon: '' } as ZenithConfig;
  return resolveOgAssets(config, parsed.og as OgOptions, paths);
}

describe('resolveOgAssets', () => {
  it('finds images in the project and in public', () => {
    const assets = resolve({ og: { logo: { src: '/logo.png' }, background: './src/card.svg' } });
    expect(assets.logo).toBe(join(dir, 'public', 'logo.png'));
    expect(assets.background).toBe(join(dir, 'src', 'card.svg'));
  });

  it('falls back to the logo of the site when it is an image file', () => {
    expect(resolve({ logo: { src: '/logo.png' } }).logo).toBe(join(dir, 'public', 'logo.png'));
    expect(resolve({ logo: { src: 'https://example.com/logo.png' } }).logo).toBeUndefined();
    expect(resolve({ logo: { src: '/logo.png' }, og: { logo: false } }).logo).toBeUndefined();
  });

  it('rejects missing files and formats satori cannot draw', () => {
    expect(() => resolve({ og: { background: './missing.png' } })).toThrow(/Cannot find/);
    expect(() => resolve({ og: { background: './src/card.webp' } })).toThrow(/SVG, PNG or JPEG/);
  });

  it('puts the font of the card before Geist', () => {
    const { fonts } = resolve({
      og: { font: { name: 'Serif', files: [{ path: './src/serif.ttf', weight: 700 }] } },
    });
    expect(fonts[0]).toEqual({
      name: 'Serif',
      weight: 700,
      style: 'normal',
      path: join(dir, 'src', 'serif.ttf'),
    });
    expect(fonts.slice(1).every((font) => font.name === 'Geist')).toBe(true);
  });

  it('rejects fonts satori cannot read', () => {
    expect(() => resolve({ og: { font: { files: [{ path: './src/serif.woff2' }] } } })).toThrow(
      /TTF, OTF or WOFF/,
    );
  });
});
