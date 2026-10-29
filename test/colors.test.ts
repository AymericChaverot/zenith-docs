import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, PALETTE, contrastOn, resolveAccent, toHex } from '../src/colors';
import { ZenithConfigSchema } from '../src/config';

const theme = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');

/** Declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = theme.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return theme.slice(start, theme.indexOf('}', start));
}

describe('PALETTE', () => {
  it('matches the tokens of theme.css', () => {
    const root = rule(':root');
    expect(root).toContain(`--dark-900: ${PALETTE.dark.background}`);
    expect(root).toContain(`--dark-700: ${PALETTE.dark.border}`);
    expect(root).toContain(`--dark-600: ${PALETTE.dark.borderStrong}`);
    expect(root).toContain(`--light-100: ${PALETTE.light.background}`);
    expect(root).toContain(`--light-400: ${PALETTE.light.border}`);

    const dark = rule('.theme-dark,\n.theme-light .theme-invert');
    expect(dark).toContain(`--text: ${PALETTE.dark.text}`);
    expect(dark).toContain(`--text-2: ${PALETTE.dark.text2}`);

    const light = rule(':root,\n.theme-light,\n.theme-dark .theme-invert');
    expect(light).toContain(`--text: ${PALETTE.light.text}`);
    expect(light).toContain(`--text-2: ${PALETTE.light.text2}`);
  });

  it('matches the accent presets of theme.css', () => {
    for (const [name, { light, dark }] of Object.entries(ACCENT_COLORS)) {
      const declarations =
        name === 'neutral' ? rule(':root') : rule(`:root[data-accent='${name}']`);
      expect(declarations, name).toContain(`--zd-accent-light: ${light}`);
      expect(declarations, name).toContain(`--zd-accent-dark: ${dark}`);
    }
  });
});

describe('toHex', () => {
  it('converts oklch to sRGB', () => {
    expect(toHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(toHex('oklch(0% 0 0)')).toBe('#000000');
    expect(toHex('oklch(0.77 0.18 157)')).toBe('#16d584');
  });

  it('normalizes hex colors', () => {
    expect(toHex('#ABC')).toBe('#aabbcc');
    expect(toHex('#3b82f6')).toBe('#3b82f6');
  });

  it('rejects other formats', () => {
    expect(() => toHex('rebeccapurple')).toThrow();
  });
});

describe('contrastOn', () => {
  it('picks white on dark colors and near black on light ones', () => {
    expect(contrastOn('#1e3a8a')).toBe('oklch(100% 0 0)');
    expect(contrastOn('#fde047')).toBe('oklch(21% 0.006 286)');
  });
});

describe('resolveAccent', () => {
  it('resolves a preset', () => {
    expect(resolveAccent('teal')).toMatchObject({ name: 'teal', ...ACCENT_COLORS.teal });
  });

  it('uses a single color for both schemes', () => {
    expect(resolveAccent('#3b82f6')).toMatchObject({
      name: 'custom',
      light: '#3b82f6',
      dark: '#3b82f6',
    });
  });

  it('takes a color per scheme', () => {
    const accent = resolveAccent({ light: '#1d4ed8', dark: '#93c5fd' });
    expect(accent).toMatchObject({ name: 'custom', light: '#1d4ed8', dark: '#93c5fd' });
    expect(accent.contrastLight).toBe('oklch(100% 0 0)');
    expect(accent.contrastDark).toBe('oklch(21% 0.006 286)');
  });
});

describe('accent option', () => {
  it('accepts presets and supported colors', () => {
    for (const accent of [
      'violet',
      '#3b82f6',
      'oklch(60% 0.2 250)',
      { light: '#000', dark: '#fff' },
    ]) {
      expect(ZenithConfigSchema.safeParse({ accent }).success, JSON.stringify(accent)).toBe(true);
    }
  });

  it('rejects other values', () => {
    for (const accent of ['blue', 'rgb(0 0 0)', { light: '#000' }]) {
      expect(ZenithConfigSchema.safeParse({ accent }).success, JSON.stringify(accent)).toBe(false);
    }
  });
});
