export interface PageTreeDoc {
  id: string;
  /** Path relative to the docs directory, with forward slashes, e.g. `guides/intro.mdx`. */
  path: string;
  title: string;
  icon?: string;
  hidden?: boolean;
}

export interface PageTreeMeta {
  title?: string;
  description?: string;
  icon?: string;
  pages?: string[];
  defaultOpen?: boolean;
  collapsible?: boolean;
  root?: boolean;
}

export interface PageNode {
  type: 'page';
  name: string;
  url: string;
  icon?: string;
  external?: boolean;
}

export interface SeparatorNode {
  type: 'separator';
  name: string;
}

export interface FolderNode {
  type: 'folder';
  name: string;
  /** Folder path relative to the docs directory. */
  dir: string;
  icon?: string;
  description?: string;
  index?: PageNode;
  children: TreeNode[];
  defaultOpen: boolean;
  collapsible: boolean;
  root: boolean;
}

export type TreeNode = PageNode | SeparatorNode | FolderNode;

export interface PageTree {
  children: TreeNode[];
}

export function slugFromId(id: string): string | undefined {
  if (id === 'index') return undefined;
  if (id.endsWith('/index')) return id.slice(0, -'/index'.length);
  return id;
}

export function urlFromId(id: string, base = '/'): string {
  const slug = slugFromId(id);
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return slug ? `${prefix}${slug}/` : prefix;
}

const SEPARATOR = /^---(.*)---$/;
const LINK = /^(external:)?\[(.+?)\]\((.+)\)$/;

/**
 * Build the navigation tree from docs pages and `meta.json` files, following Fumadocs conventions:
 * `...` (rest), `z...a` (reversed rest), `...folder` (extract), `!name` (exclude),
 * `---Label---` (separator) and `[Text](url)` (link).
 */
export function buildPageTree(
  docs: PageTreeDoc[],
  metas: Map<string, PageTreeMeta>,
  { base = '/' }: { base?: string } = {},
): PageTree {
  const files = new Map<string, PageTreeDoc>();
  const dirs = new Set<string>(['']);

  for (const doc of docs) {
    const key = stripExtension(doc.path);
    files.set(key, doc);
    addAncestors(dirname(key));
  }
  for (const dir of metas.keys()) addAncestors(dir);

  return { children: buildDir('') };

  function addAncestors(dir: string) {
    while (dir && !dirs.has(dir)) {
      dirs.add(dir);
      dir = dirname(dir);
    }
  }

  function makePage(doc: PageTreeDoc): PageNode {
    return { type: 'page', name: doc.title, url: urlFromId(doc.id, base), icon: doc.icon };
  }

  function buildFolder(dir: string): FolderNode | undefined {
    const meta = metas.get(dir) ?? {};
    const indexDoc = files.get(join(dir, 'index'));
    const children = buildDir(dir);
    const index = indexDoc && !indexDoc.hidden ? makePage(indexDoc) : undefined;
    if (children.length === 0 && !index) return undefined;

    return {
      type: 'folder',
      name: meta.title ?? indexDoc?.title ?? humanize(basename(dir)),
      dir,
      icon: meta.icon ?? indexDoc?.icon,
      description: meta.description,
      index,
      children,
      defaultOpen: meta.defaultOpen ?? false,
      collapsible: meta.collapsible ?? true,
      root: meta.root ?? false,
    };
  }

  function resolveItem(dir: string, name: string): TreeNode | undefined {
    const key = join(dir, name.replace(/^\.\//, '').replace(/\/$/, ''));
    const doc = files.get(key);
    if (doc) return doc.hidden ? undefined : makePage(doc);
    if (dirs.has(key)) return buildFolder(key);
    return undefined;
  }

  function buildDir(dir: string): TreeNode[] {
    const isRoot = dir === '';
    const available = new Set<string>();
    for (const key of files.keys()) {
      if (dirname(key) !== dir) continue;
      const name = basename(key);
      if (isRoot || name !== 'index') available.add(name);
    }
    for (const key of dirs) {
      if (key && dirname(key) === dir) available.add(basename(key));
    }

    const pages = metas.get(dir)?.pages;
    if (!pages) return rest(dir, [...available], false);

    const used = new Set<string>();
    const excluded = new Set<string>();
    for (const entry of pages) {
      if (SEPARATOR.test(entry) || LINK.test(entry) || entry === '...' || entry === 'z...a') continue;
      if (entry.startsWith('!')) excluded.add(entry.slice(1));
      else used.add(normalizeName(entry.startsWith('...') ? entry.slice(3) : entry));
    }

    const nodes: TreeNode[] = [];
    for (const entry of pages) {
      const separator = SEPARATOR.exec(entry);
      if (separator) {
        nodes.push({ type: 'separator', name: separator[1]!.trim() });
        continue;
      }
      const link = LINK.exec(entry);
      if (link) {
        const url = link[3]!;
        nodes.push({
          type: 'page',
          name: link[2]!,
          url,
          external: Boolean(link[1]) || /^[a-z]+:\/\//i.test(url),
        });
        continue;
      }
      if (entry === '...' || entry === 'z...a') {
        const remaining = [...available].filter((name) => !used.has(name) && !excluded.has(name));
        nodes.push(...rest(dir, remaining, entry === 'z...a'));
        continue;
      }
      if (entry.startsWith('!')) continue;
      if (entry.startsWith('...')) {
        const folder = buildFolder(join(dir, normalizeName(entry.slice(3))));
        if (folder) nodes.push(...(folder.index ? [folder.index] : []), ...folder.children);
        continue;
      }
      const node = resolveItem(dir, entry);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  function rest(dir: string, names: string[], reverse: boolean): TreeNode[] {
    const sorted = names
      .filter((name) => name !== 'index')
      .sort((a, b) => a.localeCompare(b));
    if (reverse) sorted.reverse();
    if (names.includes('index')) sorted.unshift('index');
    return sorted.flatMap((name) => resolveItem(dir, name) ?? []);
  }
}

/** All pages in navigation order, skipping external links. */
export function flattenTree(nodes: TreeNode[]): PageNode[] {
  return nodes.flatMap((node): PageNode[] => {
    if (node.type === 'separator') return [];
    if (node.type === 'page') return node.external ? [] : [node];
    return [...(node.index ? [node.index] : []), ...flattenTree(node.children)];
  });
}

/** Folders leading to the page with the given URL, outermost first. */
export function findTrail(nodes: TreeNode[], url: string): FolderNode[] {
  for (const node of nodes) {
    if (node.type !== 'folder') continue;
    if (node.index?.url === url) return [node];
    const inner = findTrail(node.children, url);
    if (inner.length > 0 || node.children.some((c) => c.type === 'page' && c.url === url)) {
      return [node, ...inner];
    }
  }
  return [];
}

export function getRootFolders(nodes: TreeNode[]): FolderNode[] {
  return nodes.flatMap((node): FolderNode[] => {
    if (node.type !== 'folder') return [];
    return node.root ? [node, ...getRootFolders(node.children)] : getRootFolders(node.children);
  });
}

export interface SidebarScope {
  /** Root folders, rendered as sidebar tabs. */
  tabs: FolderNode[];
  /** Root folder containing the current page, if any. */
  activeTab?: FolderNode;
  /** Nodes to render in the sidebar. */
  nodes: TreeNode[];
  /** Pages in navigation order within the current scope. */
  pages: PageNode[];
}

/** Restrict the tree to the root folder containing the current page, Fumadocs-style. */
export function getSidebarScope(tree: PageTree, url: string): SidebarScope {
  const tabs = getRootFolders(tree.children);
  const activeTab = findTrail(tree.children, url).findLast((folder) => folder.root);
  const nodes = withoutRootFolders(activeTab ? activeTab.children : tree.children);
  const pages = activeTab?.index ? [activeTab.index, ...flattenTree(nodes)] : flattenTree(nodes);
  return { tabs, activeTab, nodes, pages };
}

export function getNeighbours(pages: PageNode[], url: string) {
  const index = pages.findIndex((page) => page.url === url);
  if (index === -1) return {};
  return { previous: pages[index - 1], next: pages[index + 1] };
}

function withoutRootFolders(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node): TreeNode[] => {
    if (node.type !== 'folder') return [node];
    if (node.root) return [];
    return [{ ...node, children: withoutRootFolders(node.children) }];
  });
}

function normalizeName(name: string): string {
  return name.replace(/^\.\//, '').replace(/\/$/, '');
}

function stripExtension(path: string): string {
  return path.replace(/\.(md|mdx)$/, '');
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function join(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

function humanize(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
