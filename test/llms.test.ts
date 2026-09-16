import { describe, expect, it } from 'vitest';
import {
  getSections,
  renderLlmsFull,
  renderLlmsIndex,
  renderPage,
  toPlainMarkdown,
  type LlmsPage,
} from '../src/llms';
import { buildPageTree, type PageTreeDoc, type PageTreeMeta } from '../src/page-tree';

function doc(path: string, title: string): PageTreeDoc {
  return { id: path.replace(/\.mdx?$/, ''), path, title };
}

const page = (url: string, title: string, extra: Partial<LlmsPage> = {}): [string, LlmsPage] => [
  url,
  { title, url, body: `Body of ${title}.`, ...extra },
];

describe('toPlainMarkdown', () => {
  it('drops imports and exports', () => {
    const body = [
      "import Thing from '../Thing.astro';",
      "export const value = 1;",
      '',
      '# Title',
      '',
      'Text with `import` inside.',
    ].join('\n');
    expect(toPlainMarkdown(body)).toBe('# Title\n\nText with `import` inside.');
  });

  it('collapses blank lines', () => {
    expect(toPlainMarkdown('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('getSections', () => {
  const metas = new Map<string, PageTreeMeta>([
    ['', { pages: ['index', '---Guides---', 'guides', '[External](https://example.com)'] }],
  ]);
  const tree = buildPageTree(
    [doc('index.mdx', 'Home'), doc('guides/one.mdx', 'One'), doc('guides/two.mdx', 'Two')],
    metas,
  );

  it('groups loose pages and folders', () => {
    expect(getSections(tree)).toEqual([
      { urls: ['/'] },
      { name: 'Guides', urls: ['/guides/one/', '/guides/two/'] },
    ]);
  });

  it('skips external links', () => {
    expect(getSections(tree).flatMap((section) => section.urls)).not.toContain(
      'https://example.com',
    );
  });
});

describe('rendering', () => {
  const sections = [
    { urls: ['/'] },
    { name: 'Guides', urls: ['/guides/one/'] },
  ];
  const pages = new Map([
    page('/', 'Home', { description: 'The home page.' }),
    page('/guides/one/', 'One'),
  ]);

  it('renders the llms.txt index', () => {
    expect(renderLlmsIndex({ title: 'Docs', description: 'A site.', sections, pages })).toBe(
      [
        '# Docs',
        '',
        '> A site.',
        '',
        '## Docs',
        '',
        '- [Home](/): The home page.',
        '',
        '## Guides',
        '',
        '- [One](/guides/one/)',
        '',
      ].join('\n'),
    );
  });

  it('renders a single page', () => {
    expect(renderPage(pages.get('/')!)).toBe(
      '# Home\n\n> The home page.\n\nSource: /\n\nBody of Home.',
    );
  });

  it('bundles every page in llms-full.txt', () => {
    const full = renderLlmsFull({ title: 'Docs', sections, pages });
    expect(full).toContain('# Docs');
    expect(full.split('\n---\n')).toHaveLength(3);
    expect(full).toContain('Body of One.');
  });
});
