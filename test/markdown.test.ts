import { markdownToHtml } from 'satteri';
import { describe, expect, it, vi } from 'vitest';
import {
  directivesRestorationPlugin,
  zenithHastPlugins,
  zenithMdastPlugins,
  type TranslationsForFile,
} from '../src/markdown/index';
import type { MermaidOptions } from '../src/config';
import { getTranslations } from '../src/translations';

function render(
  source: string,
  options: {
    base?: string;
    t?: TranslationsForFile;
    math?: boolean;
    mermaid?: MermaidOptions;
  } = {},
) {
  const { html } = markdownToHtml(source, {
    features: { directive: true, math: options.math ?? false },
    mdastPlugins: [...zenithMdastPlugins(options.t), directivesRestorationPlugin()],
    hastPlugins: zenithHastPlugins(options.t, options.base, options.mermaid),
  }) as { html: string };
  return html.trim();
}

describe('callouts', () => {
  it('turns directives into callouts', () => {
    expect(render(':::warning\nBody\n:::')).toBe(
      '<aside class="zd-callout" data-callout="warning"><p class="zd-callout-title">Warning</p><div class="zd-callout-body"><p>Body</p></div></aside>',
    );
  });

  it('takes a custom title', () => {
    expect(render(':::tip[Before you start]\nBody\n:::')).toContain(
      '<p class="zd-callout-title">Before you start</p>',
    );
  });

  it('resolves aliases', () => {
    expect(render(':::caution\nBody\n:::')).toContain('data-callout="danger"');
    expect(render(':::caution\nBody\n:::')).toContain('>Caution</p>');
  });

  it('turns GitHub alerts into callouts', () => {
    const html = render('> [!NOTE]\n> Read this.');
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('<div class="zd-callout-body"><p>Read this.</p></div>');
  });

  it('leaves other blockquotes alone', () => {
    expect(render('> [!NOPE]\n> Quote')).toMatch(/^<blockquote>/);
  });

  it('translates default titles', () => {
    const t = () => getTranslations('fr');
    expect(render(':::warning\nCorps\n:::', { t })).toContain('>Avertissement</p>');
  });
});

describe('directives', () => {
  it('restores text that is not a directive', () => {
    expect(render('Meet at 10:30 or :unknown')).toBe('<p>Meet at 10:30 or :unknown</p>');
  });
});

describe('headings', () => {
  it('adds an anchor', () => {
    expect(render('## Getting started')).toBe(
      '<div class="zd-heading zd-heading-h2"><h2 id="getting-started">Getting started</h2><a class="zd-anchor" href="#getting-started" aria-label="Link to this section" data-pagefind-ignore=""></a></div>',
    );
  });

  it('takes a custom id', () => {
    expect(render('## Getting started [#start]')).toContain('<h2 id="start">Getting started</h2>');
  });

  it('keeps ids unique', () => {
    const html = render('## Usage\n\n## Usage');
    expect(html).toContain('id="usage"');
    expect(html).toContain('id="usage-1"');
  });

  it('leaves the page title alone', () => {
    expect(render('# Title')).toBe('<h1>Title</h1>');
  });
});

describe('code blocks', () => {
  it('adds a copy button', () => {
    expect(render('```js\nx\n```')).toBe(
      '<figure class="zd-code"><pre><code class="language-js">x\n</code></pre><button type="button" class="zd-copy" aria-label="Copy code" data-copy=""></button></figure>',
    );
  });
});

describe('links', () => {
  it('prefixes root links with the base', () => {
    expect(render('[Install](/installation/)', { base: '/docs/' })).toBe(
      '<p><a href="/docs/installation/">Install</a></p>',
    );
  });

  it('leaves links alone without a base', () => {
    expect(render('[Install](/installation/)')).toBe('<p><a href="/installation/">Install</a></p>');
  });
});

describe('package managers', () => {
  it('turns npm blocks into tabs', () => {
    const html = render('```npm\nnpm i zenith-docs\n```');
    expect(html).toMatch(/^<zd-tabs class="zd-tabs" data-group="package-manager" data-persist="">/);
    expect(html).toContain('data-value="pnpm"');
    expect(html).toContain('<code class="language-sh">pnpm add zenith-docs\n</code>');
    expect(html).toContain('<code class="language-sh">bun add zenith-docs\n</code>');
  });
});

describe('mermaid', () => {
  const diagram = '```mermaid\ngraph LR\n  A --> B\n```';

  it('draws diagrams as inline SVG', () => {
    const html = render(diagram);
    expect(html).toMatch(/^<figure class="zd-mermaid"><svg /);
    expect(html).toContain('--fg:var(--text)');
  });

  it('scopes the styles of diagrams and loads no font', () => {
    const html = render(diagram);
    expect(html).toContain('.zd-mermaid svg {');
    expect(html).not.toMatch(/@import|googleapis|^\s*svg \{/m);
  });

  it('leaves unsupported diagrams as code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = render('```mermaid\ngantt\n  title Plan\n```');
    expect(html).toContain('<code class="language-mermaid">');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('mermaid options', () => {
  const fence = (meta: string, body = 'graph LR\n  A --> B') =>
    '```mermaid' + meta + '\n' + body + '\n```';
  const options = (mermaid: Partial<MermaidOptions>): MermaidOptions => ({
    spacing: 'normal',
    colors: {},
    fallback: 'code',
    ...mermaid,
  });
  const width = (html: string) => Number(/viewBox="0 0 (\d+)/.exec(html)![1]);

  it('spaces the nodes with the spacing option', () => {
    const compact = render(fence(''), { mermaid: options({ spacing: 'compact' }) });
    expect(width(compact)).toBeLessThan(width(render(fence(''))));
  });

  it('lets a keyword on the code block override the spacing', () => {
    expect(width(render(fence(' wide')))).toBeGreaterThan(width(render(fence(''))));
    const compact = options({ spacing: 'compact' });
    expect(width(render(fence(' wide'), { mermaid: compact }))).toBe(width(render(fence(' wide'))));
  });

  it('takes the colors of the options', () => {
    const html = render(fence(''), { mermaid: options({ colors: { line: 'hotpink' } }) });
    expect(html).toContain('--line:hotpink');
  });

  it('adds a title below the diagram', () => {
    expect(render(fence(' title="Flow <1>"'))).toContain(
      '<figcaption class="zd-mermaid-title">Flow &lt;1&gt;</figcaption>',
    );
  });

  it('fails the build on unsupported diagrams with the error fallback', () => {
    expect(() =>
      render(fence('', 'gantt\n  title Plan'), { mermaid: options({ fallback: 'error' }) }),
    ).toThrow(/Mermaid diagram/);
  });
});

describe('math', () => {
  it('renders TeX as MathML', () => {
    expect(render('Euler: $e^{i\\pi} = -1$', { math: true })).toContain(
      '<span class="katex"><math><semantics><mrow><msup><mi>e</mi>',
    );
    expect(render('$$\n\\int_0^1 x\\,dx\n$$', { math: true })).toContain('display="block"');
  });

  it('leaves dollar signs alone when math is off', () => {
    expect(render('From $5 to $10')).toBe('<p>From $5 to $10</p>');
  });
});
