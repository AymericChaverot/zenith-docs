import { renderMermaidSVG } from 'beautiful-mermaid';

/**
 * A Mermaid diagram as inline SVG, drawn with the colors of the site so it follows
 * the color scheme. Throws when the diagram is invalid or of an unsupported type.
 */
export function renderMermaid(source: string): string {
  const svg = renderMermaidSVG(source, {
    bg: 'var(--background)',
    fg: 'var(--text)',
    accent: 'var(--accent)',
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
