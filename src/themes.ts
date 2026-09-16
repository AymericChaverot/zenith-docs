import type { FontPresetName } from './fonts';
import type { Accent, Backdrop, BackdropPosition } from './options';

/**
 * A packaged theme is a named set of option defaults: an accent, a backdrop and a font
 * preset that go together. Options you set yourself always win over the theme.
 *
 * Tokens that are not options, such as corner radii, live in `styles/themes.css`
 * under `[data-theme='…']`.
 */
export interface PackagedTheme {
  label: string;
  accent: Accent;
  backdrop: Backdrop;
  backdropPosition?: BackdropPosition;
  fonts: FontPresetName;
}

export const THEMES = {
  /** The defaults of ZenithDocs. */
  zenith: {
    label: 'Zenith',
    accent: 'emerald',
    backdrop: 'dither',
    backdropPosition: 'left',
    fonts: 'instrument',
  },
  /** Cool and sober, with squarer corners. */
  slate: {
    label: 'Slate',
    accent: 'neutral',
    backdrop: 'grid',
    fonts: 'schibsted',
  },
  /** Sharp corners and a technical face, for developer tools. */
  terminal: {
    label: 'Terminal',
    accent: 'teal',
    backdrop: 'grain',
    fonts: 'space',
  },
  /** Quiet and roomy, for documentation that reads like prose. */
  paper: {
    label: 'Paper',
    accent: 'amber',
    backdrop: 'none',
    fonts: 'literata',
  },
  /** Soft colour fields and rounded corners. */
  aurora: {
    label: 'Aurora',
    accent: 'violet',
    backdrop: 'aurora',
    fonts: 'geist',
  },
} satisfies Record<string, PackagedTheme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];

/** Options a theme fills in, when they were not set explicitly. */
export const THEMED_OPTIONS = ['accent', 'backdrop', 'backdropPosition', 'fonts'] as const;
