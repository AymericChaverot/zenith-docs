/**
 * Font presets, self-hosted through the Astro Fonts API.
 *
 * Each preset fills three CSS variables: `--zd-font-sans` for the interface and body,
 * `--zd-font-mono` for code, and `--zd-font-display` for the largest headings when the
 * preset gives them a voice of their own.
 */

export interface FontFamily {
  name: string;
  /** A range for a variable font, explicit values for a static one. */
  weights: (string | number)[];
  styles?: ('normal' | 'italic')[];
  fallbacks: string[];
}

export interface FontPreset {
  sans: FontFamily;
  mono: FontFamily;
  /** Used for `h1` and `h2`. Smaller headings stay on `sans`, where a display face suffers. */
  display?: FontFamily;
  /** Weight of the large headings, for display faces that ship a single one. */
  displayWeight?: number;
}

const SANS = ['system-ui', 'sans-serif'];
const SERIF = ['Georgia', 'serif'];
const MONO = ['ui-monospace', 'monospace'];

export const FONT_PRESETS = {
  /** Instrument Sans and Instrument Serif, drawn as a pair. The default. */
  instrument: {
    sans: {
      name: 'Instrument Sans',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      fallbacks: SANS,
    },
    display: { name: 'Instrument Serif', weights: [400], fallbacks: SERIF },
    displayWeight: 400,
    mono: { name: 'Martian Mono', weights: ['400 700'], fallbacks: MONO },
  },
  /** Vercel's Geist, what ZenithDocs shipped before. */
  geist: {
    sans: { name: 'Geist', weights: ['100 900'], fallbacks: SANS },
    mono: { name: 'Geist Mono', weights: ['100 900'], fallbacks: MONO },
  },
  /** A warmer serif over a rounded grotesque. */
  newsreader: {
    sans: { name: 'Onest', weights: ['400 700'], fallbacks: SANS },
    display: { name: 'Newsreader', weights: ['400 700'], fallbacks: SERIF },
    mono: { name: 'IBM Plex Mono', weights: [400, 600], fallbacks: MONO },
  },
  /** One neutral grotesque throughout. */
  schibsted: {
    sans: { name: 'Schibsted Grotesk', weights: ['400 700'], fallbacks: SANS },
    mono: { name: 'JetBrains Mono', weights: ['400 700'], fallbacks: MONO },
  },
  /** A technical register, with a matching mono. */
  space: {
    sans: { name: 'Space Grotesk', weights: ['400 700'], fallbacks: SANS },
    mono: { name: 'Space Mono', weights: [400, 700], fallbacks: MONO },
  },
  /** Atkinson Hyperlegible, drawn by the Braille Institute for low vision. */
  atkinson: {
    sans: {
      name: 'Atkinson Hyperlegible',
      weights: [400, 700],
      styles: ['normal', 'italic'],
      fallbacks: SANS,
    },
    mono: { name: 'JetBrains Mono', weights: ['400 700'], fallbacks: MONO },
  },
  /** A serif for the body, for documentation that reads like prose. */
  literata: {
    sans: {
      name: 'Literata',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      fallbacks: SERIF,
    },
    mono: { name: 'IBM Plex Mono', weights: [400, 600], fallbacks: MONO },
  },
} satisfies Record<string, FontPreset>;

export type FontPresetName = keyof typeof FONT_PRESETS;

export const FONT_PRESET_NAMES = Object.keys(FONT_PRESETS) as [FontPresetName, ...FontPresetName[]];

/** CSS variables the presets fill, in the order the families are declared. */
export const FONT_VARIABLES = {
  sans: '--zd-font-sans',
  mono: '--zd-font-mono',
  display: '--zd-font-display',
} as const;
