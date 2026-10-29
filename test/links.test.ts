import { describe, expect, it } from 'vitest';
import { findBrokenLinks, parsePage } from '../src/links';

const pages = [
  parsePage(
    '/docs/',
    '<h2 id="start">Start</h2><a href="/docs/guide/#install">Guide</a><a href="#start">Top</a>',
  ),
  parsePage('/docs/guide/', '<h2 id="install">Install</h2><a href="../">Home</a>'),
];

const files = new Set(['/docs/og/index.png']);
const check = (links: string[]) =>
  findBrokenLinks([...pages, { url: '/docs/test/', ids: new Set(), links }], (path) =>
    files.has(path),
  );

describe('parsePage', () => {
  it('reads ids and links', () => {
    const page = parsePage('/', '<h2 id="a&amp;b">A</h2><a class="x" href="/b/?q=1&amp;r=2">B</a>');
    expect(page.ids).toEqual(new Set(['a&b']));
    expect(page.links).toEqual(['/b/?q=1&r=2']);
  });
});

describe('findBrokenLinks', () => {
  it('accepts links to pages, ids and files', () => {
    expect(findBrokenLinks(pages, () => false)).toEqual([]);
    expect(
      check(['/docs/guide/', '/docs/guide', '../guide/#install', '/docs/og/index.png']),
    ).toEqual([]);
  });

  it('reports links to missing pages', () => {
    expect(check(['/docs/missing/'])).toEqual([
      { page: '/docs/test/', href: '/docs/missing/', reason: 'page' },
    ]);
  });

  it('reports links to missing ids', () => {
    expect(check(['/docs/guide/#deploy'])).toEqual([
      { page: '/docs/test/', href: '/docs/guide/#deploy', reason: 'anchor' },
    ]);
  });

  it('decodes ids', () => {
    const page = parsePage('/docs/', '<h2 id="café">Café</h2>');
    expect(
      findBrokenLinks(
        [page, { url: '/x/', ids: new Set(), links: ['/docs/#caf%C3%A9'] }],
        () => false,
      ),
    ).toEqual([]);
  });

  it('skips external links', () => {
    expect(
      check(['https://example.com/missing', 'mailto:a@b.c', '//cdn.example.com/x.js']),
    ).toEqual([]);
  });
});
