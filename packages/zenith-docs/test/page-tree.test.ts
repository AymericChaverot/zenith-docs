import { describe, expect, it } from 'vitest';
import {
  buildPageTree,
  findTrail,
  flattenTree,
  getNeighbours,
  getSidebarScope,
  slugFromId,
  urlFromId,
  type PageTreeDoc,
  type PageTreeMeta,
} from '../src/page-tree';

function doc(path: string, title = path, extra: Partial<PageTreeDoc> = {}): PageTreeDoc {
  return { id: path.replace(/\.mdx?$/, ''), path, title, ...extra };
}

const names = (nodes: { name: string }[]) => nodes.map((node) => node.name);

describe('urls', () => {
  it('maps ids to slugs and urls', () => {
    expect(slugFromId('index')).toBeUndefined();
    expect(slugFromId('guides/index')).toBe('guides');
    expect(urlFromId('guides/intro')).toBe('/guides/intro/');
    expect(urlFromId('index', '/docs')).toBe('/docs/');
  });
});

describe('buildPageTree', () => {
  it('sorts alphabetically with index first by default', () => {
    const tree = buildPageTree([doc('b.mdx'), doc('index.mdx'), doc('a.mdx')], new Map());
    expect(names(tree.children)).toEqual(['index.mdx', 'a.mdx', 'b.mdx']);
  });

  it('turns folders into nodes using their index page', () => {
    const tree = buildPageTree(
      [doc('guides/index.mdx', 'Guides'), doc('guides/setup.mdx', 'Setup')],
      new Map(),
    );
    const folder = tree.children[0];
    expect(folder).toMatchObject({ type: 'folder', name: 'Guides', index: { url: '/guides/' } });
    expect(folder?.type === 'folder' && names(folder.children)).toEqual(['Setup']);
  });

  it('humanizes folder names without meta or index', () => {
    const tree = buildPageTree([doc('getting-started/install.mdx')], new Map());
    expect(tree.children[0]?.name).toBe('Getting started');
  });

  it('follows meta.json conventions', () => {
    const metas = new Map<string, PageTreeMeta>([
      ['', { pages: ['intro', '---Guides---', '...', '!secret', '[GitHub](https://github.com)'] }],
    ]);
    const tree = buildPageTree(
      [doc('intro.mdx', 'Intro'), doc('b.mdx', 'B'), doc('a.mdx', 'A'), doc('secret.mdx', 'Secret')],
      metas,
    );
    expect(tree.children.map((n) => [n.type, n.name])).toEqual([
      ['page', 'Intro'],
      ['separator', 'Guides'],
      ['page', 'A'],
      ['page', 'B'],
      ['page', 'GitHub'],
    ]);
    expect(tree.children[4]).toMatchObject({ external: true });
  });

  it('supports reversed rest and folder extraction', () => {
    const metas = new Map<string, PageTreeMeta>([['', { pages: ['...api', 'z...a'] }]]);
    const tree = buildPageTree(
      [doc('api/get.mdx', 'Get'), doc('a.mdx', 'A'), doc('b.mdx', 'B')],
      metas,
    );
    expect(names(tree.children)).toEqual(['Get', 'B', 'A']);
  });

  it('omits hidden pages from the tree', () => {
    const tree = buildPageTree([doc('a.mdx', 'A', { hidden: true }), doc('b.mdx', 'B')], new Map());
    expect(names(tree.children)).toEqual(['B']);
  });

  it('uses meta title and options for folders', () => {
    const metas = new Map<string, PageTreeMeta>([['guides', { title: 'All guides', defaultOpen: true }]]);
    const tree = buildPageTree([doc('guides/a.mdx')], metas);
    expect(tree.children[0]).toMatchObject({ name: 'All guides', defaultOpen: true, collapsible: true });
  });
});

describe('navigation helpers', () => {
  const metas = new Map<string, PageTreeMeta>([
    ['api', { title: 'API', root: true }],
    ['', { pages: ['index', 'guides', 'api'] }],
  ]);
  const tree = buildPageTree(
    [
      doc('index.mdx', 'Home'),
      doc('guides/one.mdx', 'One'),
      doc('guides/two.mdx', 'Two'),
      doc('api/index.mdx', 'API home'),
      doc('api/client.mdx', 'Client'),
    ],
    metas,
  );

  it('flattens pages in order', () => {
    expect(flattenTree(tree.children).map((p) => p.url)).toEqual([
      '/',
      '/guides/one/',
      '/guides/two/',
      '/api/',
      '/api/client/',
    ]);
  });

  it('finds the folder trail of a page', () => {
    expect(names(findTrail(tree.children, '/guides/two/'))).toEqual(['Guides']);
    expect(findTrail(tree.children, '/')).toEqual([]);
  });

  it('scopes the sidebar to root folders', () => {
    const outside = getSidebarScope(tree, '/guides/one/');
    expect(names(outside.tabs)).toEqual(['API']);
    expect(outside.activeTab).toBeUndefined();
    expect(names(outside.nodes)).toEqual(['Home', 'Guides']);

    const inside = getSidebarScope(tree, '/api/client/');
    expect(inside.activeTab?.name).toBe('API');
    expect(inside.pages.map((p) => p.url)).toEqual(['/api/', '/api/client/']);
  });

  it('returns previous and next pages', () => {
    const { pages } = getSidebarScope(tree, '/guides/one/');
    const { previous, next } = getNeighbours(pages, '/guides/one/');
    expect(previous?.url).toBe('/');
    expect(next?.url).toBe('/guides/two/');
  });
});
