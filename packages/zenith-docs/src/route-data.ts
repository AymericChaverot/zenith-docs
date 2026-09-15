import type { MarkdownHeading } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import config from 'virtual:zenith/config';
import { root } from 'virtual:zenith/project';
import type { ZenithConfig } from './config';
import type { DocsFrontmatter, MetaData } from './content';
import { getLastUpdated } from './git';
import {
  buildPageTree,
  findTrail,
  getNeighbours,
  getSidebarScope,
  slugFromId,
  urlFromId,
  type PageNode,
  type PageTree,
  type SidebarScope,
} from './page-tree';

export interface DocsEntry {
  id: string;
  filePath?: string;
  data: DocsFrontmatter;
}

export interface RouteData {
  config: ZenithConfig;
  entry: DocsEntry;
  url: string;
  title: string;
  description?: string;
  headings: MarkdownHeading[];
  /** Headings shown in the table of contents. */
  toc: MarkdownHeading[];
  tree: PageTree;
  sidebar: SidebarScope;
  breadcrumbs: { name: string; url?: string }[];
  previous?: PageNode;
  next?: PageNode;
  editUrl?: string;
  lastUpdated?: Date;
}

export async function getDocs(): Promise<DocsEntry[]> {
  const docs = (await getCollection('docs' as never)) as unknown as CollectionEntry<never>[];
  return (docs as unknown as DocsEntry[]).filter((entry) => import.meta.env.DEV || !entry.data.draft);
}

export function getDocsPaths(docs: DocsEntry[]) {
  return docs.map((entry) => ({ params: { slug: slugFromId(entry.id) }, props: { entry } }));
}

let cachedTree: Promise<PageTree> | undefined;

export function getPageTree(): Promise<PageTree> {
  if (import.meta.env.DEV) return loadPageTree();
  return (cachedTree ??= loadPageTree());
}

async function loadPageTree(): Promise<PageTree> {
  const [docs, metas] = await Promise.all([getDocs(), getMetas()]);
  const docsDir = config.docsDir.replace(/^\.\//, '').replace(/\/$/, '');

  return buildPageTree(
    docs.map((entry) => ({
      id: entry.id,
      path: (entry.filePath ?? `${entry.id}.md`).replaceAll('\\', '/').replace(`${docsDir}/`, ''),
      title: entry.data.sidebar.label ?? entry.data.title,
      icon: entry.data.icon,
      hidden: entry.data.sidebar.hidden,
    })),
    new Map(metas.map((meta) => [meta.id.replace(/\/?meta\.json$/, ''), meta.data])),
    { base: import.meta.env.BASE_URL },
  );
}

async function getMetas(): Promise<{ id: string; data: MetaData }[]> {
  try {
    return (await getCollection('meta' as never)) as unknown as { id: string; data: MetaData }[];
  } catch {
    return [];
  }
}

export async function getRouteData(
  entry: DocsEntry,
  headings: MarkdownHeading[],
): Promise<RouteData> {
  const tree = await getPageTree();
  const url = urlFromId(entry.id, import.meta.env.BASE_URL);
  const sidebar = getSidebarScope(tree, url);
  const { previous, next } = getNeighbours(sidebar.pages, url);

  const trail = findTrail(tree.children, url);
  const breadcrumbs = trail
    .filter((folder) => folder.index?.url !== url)
    .map((folder) => ({ name: folder.name, url: folder.index?.url }));

  const toc = config.tableOfContents && entry.data.toc
    ? headings.filter(
        (heading) =>
          config.tableOfContents &&
          heading.depth >= config.tableOfContents.minHeadingLevel &&
          heading.depth <= config.tableOfContents.maxHeadingLevel,
      )
    : [];

  return {
    config,
    entry,
    url,
    title: entry.data.title,
    description: entry.data.description,
    headings,
    toc,
    tree,
    sidebar,
    breadcrumbs,
    previous,
    next,
    editUrl: getEditUrl(entry),
    lastUpdated: getPageLastUpdated(entry),
  };
}

function getEditUrl(entry: DocsEntry): string | undefined {
  const { editUrl } = entry.data;
  if (editUrl === false) return undefined;
  if (typeof editUrl === 'string') return editUrl;
  if (!config.editLink || !entry.filePath) return undefined;
  const base = config.editLink.baseUrl.endsWith('/')
    ? config.editLink.baseUrl
    : `${config.editLink.baseUrl}/`;
  return base + entry.filePath.replaceAll('\\', '/');
}

function getPageLastUpdated(entry: DocsEntry): Date | undefined {
  const { lastUpdated } = entry.data;
  if (lastUpdated === false) return undefined;
  if (lastUpdated instanceof Date) return lastUpdated;
  if (!config.lastUpdated || !entry.filePath) return undefined;
  return getLastUpdated(root, entry.filePath);
}
