import type { Accent } from './options';

/**
 * Colors of `styles/theme.css`, for what renders outside the browser, such as Open
 * Graph images: neither satori nor resvg parses `oklch`. A test checks both agree.
 */
export const PALETTE = {
  dark: {
    background: 'oklch(14.2% 0.004 286)',
    text: 'oklch(96.5% 0.002 286)',
    text2: 'oklch(71% 0.01 286)',
    border: 'oklch(25% 0.005 286)',
    /** `--dark-600`, a border that stands out more. */
    borderStrong: 'oklch(30% 0.006 286)',
  },
  light: {
    background: 'oklch(100% 0 0)',
    text: 'oklch(21% 0.006 286)',
    text2: 'oklch(50% 0.012 286)',
    border: 'oklch(92.4% 0.004 286)',
  },
} as const;

/** Accent presets, as `--zd-accent-light` and `--zd-accent-dark`. */
export const ACCENT_COLORS: Record<Accent, { light: string; dark: string }> = {
  emerald: { light: 'oklch(56% 0.14 160)', dark: 'oklch(77% 0.18 157)' },
  teal: { light: 'oklch(56% 0.11 192)', dark: 'oklch(79% 0.15 187)' },
  amber: { light: 'oklch(63% 0.17 58)', dark: 'oklch(81% 0.17 70)' },
  rose: { light: 'oklch(58% 0.21 12)', dark: 'oklch(72% 0.19 10)' },
  violet: { light: 'oklch(55% 0.21 290)', dark: 'oklch(73% 0.17 290)' },
  neutral: { light: 'oklch(21% 0.006 286)', dark: 'oklch(96.5% 0.002 286)' },
};


type Rgb = [number, number, number];

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i;
const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i;


/** Linear sRGB channels of a supported color, in 0–1. */
function toLinearRgb(color: string): Rgb {
  const value = color.trim();
  const hex = HEX.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => {
      const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as Rgb;
  }

  const match = OKLCH.exec(value);
  if (!match) throw new Error(`Unsupported color: ${color}`);
  const [, l, percent, c, h] = match;
  const lightness = Number(l) / (percent ? 100 : 1);
  const hue = (Number(h) * Math.PI) / 180;
  const a = Number(c) * Math.cos(hue);
  const b = Number(c) * Math.sin(hue);

  // OKLab to linear sRGB, from https://bottosson.github.io/posts/oklab/
  const l_ = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** A supported color as `#rrggbb`, clipped to the sRGB gamut. */
export function toHex(color: string): string {
  const channels = toLinearRgb(color).map((linear) => {
    const c = Math.min(1, Math.max(0, linear));
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** A supported color as `rgba()`, which satori and resvg both read. */
export function toRgba(color: string, alpha = 1): string {
  const value = Number.parseInt(toHex(color).slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
