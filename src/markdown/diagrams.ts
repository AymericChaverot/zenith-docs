import katex from 'katex';
import { renderMermaidSVG } from 'beautiful-mermaid';
import type { MermaidOptions } from '../config';

/**
 * TeX as MathML, which browsers lay out natively: no stylesheet, font or script to load.
 * Errors are shown in place, in red, instead of failing the build.
 */
export function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, { output: 'mathml', displayMode, throwOnError: false });
}

const SPACINGS: Record<
  MermaidSpacing,
  { padding: number; nodeSpacing: number; layerSpacing: number }
> = {
  compact: { padding: 24, nodeSpacing: 16, layerSpacing: 28 },
  normal: { padding: 40, nodeSpacing: 24, layerSpacing: 40 },
  wide: { padding: 56, nodeSpacing: 40, layerSpacing: 64 },
};

type MermaidSpacing = MermaidOptions['spacing'];

/** What the meta string of a ```mermaid fence sets: a spacing keyword and `title="..."`. */
export interface MermaidMeta {
  spacing?: MermaidSpacing;
  title?: string;
}

export function parseMermaidMeta(meta: string): MermaidMeta {
  const title = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  const rest = meta.replace(/title=(?:"[^"]*"|'[^']*'|\S+)/, '');
  const spacing = rest
    .split(/\s+/)
    .find((word): word is MermaidSpacing => Object.hasOwn(SPACINGS, word));
  return { spacing, title: title?.[1] ?? title?.[2] ?? title?.[3] };
}

/**
 * A Mermaid diagram as inline SVG, drawn with the colors of the site so it follows
 * the color scheme. Throws when the diagram is invalid or of an unsupported type.
 */
export function renderMermaid(
  source: string,
  options: Pick<MermaidOptions, 'colors' | 'spacing'> = { colors: {}, spacing: 'normal' },
): string {
  const { accent = 'var(--accent)', ...colors } = options.colors;
  const svg = renderMermaidSVG(source, {
    bg: 'var(--background)',
    fg: 'var(--text)',
    accent,
    ...colors,
    ...SPACINGS[options.spacing],
    transparent: true,
  });
  return svg.replace(
    /<style>([\s\S]*?)<\/style>/g,
    (_, css: string) => `<style>${scopeCss(css)}</style>`,
  );
}

/**
 * Inline SVG styles apply to the whole page, so the rules of a diagram are scoped to
 * diagrams. The web fonts it imports are dropped: diagrams use the fonts of the site.
 */
function scopeCss(css: string): string {
  return css
    .replace(/@import\s+url\([^)]*\)[^;]*;/g, '')
    .replace(/(\.mono\s*\{\s*)font-family:[^;]*;/, '$1font-family: var(--mono-family);')
    .replace(/font-family:\s*'[^']*'[^;]*;/g, 'font-family: inherit;')
    .replace(/^(\s*)([^{}@\n][^{}\n]*)\{/gm, (_, indent: string, selectors: string) => {
      const scoped = selectors
        .split(',')
        .map((selector) => `.zd-mermaid ${selector.trim()}`)
        .join(', ');
      return `${indent}${scoped} {`;
    });
}
