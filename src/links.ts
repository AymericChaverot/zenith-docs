import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BuiltPage {
  /** URL path of the page, such as `/docs/guide/`. */
  url: string;
  ids: Set<string>;
  links: string[];
}

export interface BrokenLink {
  page: string;
  href: string;
  reason: 'page' | 'anchor';
}

/** Links of a built page and the ids it declares. */
export function parsePage(url: string, html: string): BuiltPage {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => decodeHtml(id!)));
  const links = [...html.matchAll(/<a\s[^>]*?href="([^"]*)"/g)].map(([, href]) =>
    decodeHtml(href!),
  );
  return { url, ids, links };
}

/**
 * Internal links that lead nowhere: to no page or file of the build, or to an id the
 * target page does not have. External links are not checked.
 */
export function findBrokenLinks(
  pages: BuiltPage[],
  fileExists: (path: string) => boolean,
): BrokenLink[] {
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const broken: BrokenLink[] = [];

  for (const page of pages) {
    for (const href of new Set(page.links)) {
      if (!href || /^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) continue;
      const target = new URL(href, `http://site${page.url}`);
      const path = safeDecode(target.pathname);
      const id = safeDecode(target.hash.slice(1));

      const linked = byUrl.get(path) ?? byUrl.get(`${path}/`);
      if (!linked) {
        if (!fileExists(path)) broken.push({ page: page.url, href, reason: 'page' });
        continue;
      }
      if (id && !linked.ids.has(id)) broken.push({ page: page.url, href, reason: 'anchor' });
    }
  }
  return broken;
}

/** Every HTML page of a build, keyed by the URL it is served at. */
export function readBuiltPages(dir: URL, base: string): BuiltPage[] {
  const root = fileURLToPath(dir);
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return listHtml(root)
    .filter((file) => !/(^|[\\/])404\.html$/.test(file))
    .map((file) => {
      const path = relative(root, file).split(sep).join('/');
      const url = prefix + path.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/');
      return parsePage(url, readFileSync(file, 'utf8'));
    });
}

/** Whether a URL path of the site matches a file of the build. */
export function builtFileExists(dir: URL, base: string): (path: string) => boolean {
  const root = fileURLToPath(dir);
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return (path) => path.startsWith(prefix) && existsSync(join(root, path.slice(prefix.length)));
}

function listHtml(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
