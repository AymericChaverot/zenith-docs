import type { MarkdownHeading } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import config from 'virtual:zenith/config';
import { root } from 'virtual:zenith/project';
import type { ZenithConfig } from './config';
import type { DocsFrontmatter, MetaData } from './content';
import { getLastUpdated } from './git';
import {
  getDefaultLocale,
  getLocale,
  localeOf,
  resolveLocales,
  stripLocale,
  type ResolvedLocale,
} from './locales';
import {
  buildPageTree,
  findTrail,
  getNeighbours,
  getSidebarScope,
  slugFromId,
  urlFromId,
  type PageNode,
  type PageTree,
  type PageTreeMeta,
  type SidebarScope,
} from './page-tree';
import { getTranslations, type Translations } from './translations';

export interface DocsEntry {
  id: string;
  filePath?: string;
  /** Raw Markdown source, without the frontmatter. */
  body?: string;
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
  locale: ResolvedLocale;
  locales: ResolvedLocale[];
  /** The same page in every language. */
  alternates: { locale: ResolvedLocale; url: string }[];
  /** False when the page falls back to the default language. */
  translated: boolean;
  t: Translations;
}

export const locales = resolveLocales(config);
export const defaultLocale = getDefaultLocale(locales);

export function translationsFor(locale: ResolvedLocale): Translations {
  return getTranslations(locale.lang, config.translations[locale.key]);
}

export async function getDocs(): Promise<DocsEntry[]> {
  const docs = (await getCollection('docs' as never)) as unknown as CollectionEntry<never>[];
  return (docs as unknown as DocsEntry[]).filter((entry) => import.meta.env.DEV || !entry.data.draft);
}

async function getMetas(): Promise<{ id: string; data: MetaData }[]> {
  try {
    return (await getCollection('meta' as never)) as unknown as { id: string; data: MetaData }[];
  } catch {
    return [];
  }
}

const docsDir = config.docsDir.replace(/^\.\//, '').replace(/\/$/, '');

/** Path of an entry relative to the docs directory. */
function contentPath(entry: DocsEntry): string {
  return (entry.filePath ?? `${entry.id}.md`).replaceAll('\\', '/').replace(`${docsDir}/`, '');
}

/** Group entries by locale, keyed by their path without the locale prefix. */
function groupByLocale(docs: DocsEntry[]): Map<string, Map<string, DocsEntry>> {
  const groups = new Map<string, Map<string, DocsEntry>>();
  for (const entry of docs) {
    const locale = localeOf(entry.id, locales);
    const group = groups.get(locale.key) ?? new Map<string, DocsEntry>();
    group.set(stripLocale(entry.id, locale), entry);
    groups.set(locale.key, group);
  }
  return groups;
}

/** Pages of a locale, falling back to the default language for missing translations. */
function withFallback(
  groups: Map<string, Map<string, DocsEntry>>,
  locale: ResolvedLocale,
): Map<string, { entry: DocsEntry; translated: boolean }> {
  const own = groups.get(locale.key) ?? new Map();
  const base = groups.get(defaultLocale.key) ?? new Map();
  const pages = new Map<string, { entry: DocsEntry; translated: boolean }>();
  for (const id of new Set([...base.keys(), ...own.keys()])) {
    const entry = own.get(id) ?? base.get(id);
    if (entry) pages.set(id, { entry, translated: own.has(id) });
  }
  return pages;
}

export async function getDocsPaths(docs: DocsEntry[]) {
  const groups = groupByLocale(docs);
  return locales.flatMap((locale) =>
    [...withFallback(groups, locale)].map(([id, { entry, translated }]) => {
      const slug = slugFromId(id);
      const prefix = locale.prefix.slice(0, -1);
      return {
        params: { slug: [prefix, slug].filter(Boolean).join('/') || undefined },
        props: { entry, locale: locale.key, translated },
      };
    }),
  );
}

const trees = new Map<string, Promise<PageTree>>();

export function getPageTree(locale: ResolvedLocale): Promise<PageTree> {
  if (import.meta.env.DEV) return loadPageTree(locale);
  const cached = trees.get(locale.key) ?? loadPageTree(locale);
  trees.set(locale.key, cached);
  return cached;
}

async function loadPageTree(locale: ResolvedLocale): Promise<PageTree> {
  const [docs, metas] = await Promise.all([getDocs(), getMetas()]);
  const pages = withFallback(groupByLocale(docs), locale);

  const treeDocs = [...pages].map(([id, { entry }]) => ({
    id,
    path: stripLocale(contentPath(entry), localeOf(entry.id, locales)),
    title: entry.data.sidebar.label ?? entry.data.title,
    icon: entry.data.icon,
    hidden: entry.data.sidebar.hidden,
  }));

  // A locale without its own meta.json for a folder uses the default language ordering.
  const metaByDir = new Map<string, PageTreeMeta>();
  for (const key of [defaultLocale.key, locale.key]) {
    for (const meta of metas) {
      const metaLocale = localeOf(meta.id, locales);
      if (metaLocale.key !== key) continue;
      metaByDir.set(stripLocale(meta.id, metaLocale).replace(/\/?meta\.json$/, ''), meta.data);
    }
  }

  return buildPageTree(treeDocs, metaByDir, {
    base: `${import.meta.env.BASE_URL}${locale.prefix}`,
  });
}

export async function getRouteData(
  entry: DocsEntry,
  headings: MarkdownHeading[],
  { locale: localeKey = defaultLocale.key, translated = true } = {},
): Promise<RouteData> {
  const locale = getLocale(locales, localeKey);
  const t = translationsFor(locale);
  const tree = await getPageTree(locale);

  const id = stripLocale(entry.id, localeOf(entry.id, locales));
  const url = urlFromId(id, `${import.meta.env.BASE_URL}${locale.prefix}`);
  const sidebar = getSidebarScope(tree, url);
  const { previous, next } = getNeighbours(sidebar.pages, url);

  const breadcrumbs = findTrail(tree.children, url)
    .filter((folder) => folder.index?.url !== url)
    .map((folder) => ({ name: folder.name, url: folder.index?.url }));

  const toc =
    config.tableOfContents && entry.data.toc
      ? headings.filter(
          (heading) =>
            config.tableOfContents &&
            heading.slug !== 'footnote-label' &&
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
    locale,
    locales,
    alternates: locales.map((other) => ({
      locale: other,
      url: urlFromId(id, `${import.meta.env.BASE_URL}${other.prefix}`),
    })),
    translated,
    t,
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
