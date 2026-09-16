/**
 * Values shared by the config schema and the packaged themes.
 *
 * They live apart so neither has to import the other: the schema needs the theme names
 * to validate `theme`, and a theme needs the option types to describe what it sets,
 * which is a circle TypeScript cannot resolve.
 */

export const ACCENTS = ['emerald', 'teal', 'amber', 'rose', 'violet', 'neutral'] as const;

export type Accent = (typeof ACCENTS)[number];

export const BACKDROPS = [
  'none',
  'glow',
  'grid',
  'dots',
  'dither',
  'aurora',
  'rays',
  'grain',
  'horizon',
  'horizon-glow',
] as const;

export type Backdrop = (typeof BACKDROPS)[number];

export const BACKDROP_POSITIONS = ['left', 'center', 'right'] as const;

export type BackdropPosition = (typeof BACKDROP_POSITIONS)[number];
