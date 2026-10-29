import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import {
  directivesRestorationPlugin,
  zenithHastPlugins,
  zenithMdastPlugins,
  type TranslationsForFile,
} from '../src/markdown/index';
import { getTranslations } from '../src/translations';

function render(source: string, options: { base?: string; t?: TranslationsForFile } = {}) {
  const { html } = markdownToHtml(source, {
    features: { directive: true },
    mdastPlugins: [...zenithMdastPlugins(options.t), directivesRestorationPlugin()],
    hastPlugins: zenithHastPlugins(options.t, options.base),
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
