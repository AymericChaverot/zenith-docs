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
import { baseUrl } from './urls';
import {
  getDefaultVersion,
  getVersion,
  resolveVersions,
  stripVersion,
  versionOf,
  type ResolvedVersion,
} from './versions';

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
  /** Path of the generated Open Graph image, when `og` is enabled. */
  ogImage?: string;
  locale: ResolvedLocale;
  locales: ResolvedLocale[];
  /** The same page in every language, keeping the current version. */
  alternates: { locale: ResolvedLocale; url: string }[];
  version: ResolvedVersion;
  versions: ResolvedVersion[];
  /** The same page in every version, falling back to the version home page. */
  versionLinks: { version: ResolvedVersion; url: string; exists: boolean }[];
  /** False when the page falls back to the default language. */
  translated: boolean;
  t: Translations;
}

export const locales = resolveLocales(config);
export const defaultLocale = getDefaultLocale(locales);
export const versions = resolveVersions(config);
export const defaultVersion = getDefaultVersion(versions);

export function translationsFor(locale: ResolvedLocale): Translations {
  return getTranslations(locale.lang, config.translations[locale.key]);
}

/** URL prefix of a locale and version pair, for example `/fr/v1/`. */
function prefixOf(locale: ResolvedLocale, version: ResolvedVersion): string {
  return `${baseUrl()}${locale.prefix}${version.prefix}`;
}

const scopeKey = (locale: ResolvedLocale, version: ResolvedVersion) =>
  `${locale.key}|${version.key}`;

/** Path of the Open Graph image of a page, matching the `og/[...slug].png` route. */
export function ogImagePath(url: string): string {
  const path = url.slice(baseUrl().length).replace(/\/$/, '');
  return `${baseUrl()}og/${path || 'index'}.png`;
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

/** Split a content path into its locale, its version and the rest. */
export function scopeOf(path: string) {
  const locale = localeOf(path, locales);
  const withoutLocale = stripLocale(path, locale);
  const version = versionOf(withoutLocale, versions);
  return { locale, version, id: stripVersion(withoutLocale, version) };
}

type Groups = Map<string, Map<string, DocsEntry>>;

function groupByScope(docs: DocsEntry[]): Groups {
  const groups: Groups = new Map();
  for (const entry of docs) {
    const { locale, version, id } = scopeOf(entry.id);
    const key = scopeKey(locale, version);
    const group = groups.get(key) ?? new Map<string, DocsEntry>();
    group.set(id, entry);
    groups.set(key, group);
  }
  return groups;
}

/** Pages of a scope, falling back to the default language of the same version. */
function withFallback(groups: Groups, locale: ResolvedLocale, version: ResolvedVersion) {
  const own = groups.get(scopeKey(locale, version)) ?? new Map<string, DocsEntry>();
  const base = groups.get(scopeKey(defaultLocale, version)) ?? new Map<string, DocsEntry>();
  const pages = new Map<string, { entry: DocsEntry; translated: boolean }>();
  for (const id of new Set([...base.keys(), ...own.keys()])) {
    const entry = own.get(id) ?? base.get(id);
    if (entry) pages.set(id, { entry, translated: own.has(id) });
  }
  return pages;
}

let groupsCache: Promise<Groups> | undefined;

function getGroups(): Promise<Groups> {
  if (import.meta.env.DEV) return getDocs().then(groupByScope);
  return (groupsCache ??= getDocs().then(groupByScope));
}

export async function getDocsPaths(docs: DocsEntry[]) {
  const groups = groupByScope(docs);
  return locales.flatMap((locale) =>
    versions.flatMap((version) =>
      [...withFallback(groups, locale, version)].map(([id, { entry, translated }]) => ({
        params: {
          slug:
            [locale.prefix.slice(0, -1), version.prefix.slice(0, -1), slugFromId(id)]
              .filter(Boolean)
              .join('/') || undefined,
        },
        props: { entry, locale: locale.key, version: version.key, translated },
      })),
    ),
  );
}

const trees = new Map<string, Promise<PageTree>>();

export function getPageTree(
  locale: ResolvedLocale,
  version: ResolvedVersion = defaultVersion,
): Promise<PageTree> {
  if (import.meta.env.DEV) return loadPageTree(locale, version);
  const key = scopeKey(locale, version);
  const cached = trees.get(key) ?? loadPageTree(locale, version);
  trees.set(key, cached);
  return cached;
}

async function loadPageTree(
  locale: ResolvedLocale,
  version: ResolvedVersion,
): Promise<PageTree> {
  const [groups, metas] = await Promise.all([getGroups(), getMetas()]);
  const pages = withFallback(groups, locale, version);

  const treeDocs = [...pages].map(([id, { entry }]) => ({
    id,
    path: scopeOf(contentPath(entry)).id,
    title: entry.data.sidebar.label ?? entry.data.title,
    icon: entry.data.icon,
    hidden: entry.data.sidebar.hidden,
  }));

  // A locale without its own meta.json for a folder uses the default language ordering.
  const metaByDir = new Map<string, PageTreeMeta>();
  for (const key of [defaultLocale.key, locale.key]) {
    for (const meta of metas) {
      const scope = scopeOf(meta.id);
      if (scope.locale.key !== key || scope.version.key !== version.key) continue;
      metaByDir.set(scope.id.replace(/\/?meta\.json$/, ''), meta.data);
    }
  }

  return buildPageTree(treeDocs, metaByDir, { base: prefixOf(locale, version) });
}

export async function getRouteData(
  entry: DocsEntry,
  headings: MarkdownHeading[],
  {
    locale: localeKey = defaultLocale.key,
    version: versionKey = defaultVersion.key,
    translated = true,
  } = {},
): Promise<RouteData> {
  const locale = getLocale(locales, localeKey);
  const version = getVersion(versions, versionKey);
  const t = translationsFor(locale);
  const [tree, groups] = await Promise.all([getPageTree(locale, version), getGroups()]);

  const { id } = scopeOf(entry.id);
  const url = urlFromId(id, prefixOf(locale, version));
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
    ogImage: config.og ? ogImagePath(url) : undefined,
    locale,
    locales,
    alternates: locales.map((other) => ({
      locale: other,
      url: urlFromId(id, prefixOf(other, version)),
    })),
    version,
    versions,
    versionLinks: versions.map((other) => {
      const exists = withFallback(groups, locale, other).has(id);
      const prefix = prefixOf(locale, other);
      return { version: other, url: exists ? urlFromId(id, prefix) : prefix, exists };
    }),
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
