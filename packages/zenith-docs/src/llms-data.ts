import { getSections, toPlainMarkdown, type LlmsPage, type LlmsSection } from './llms';
import { urlFromId } from './page-tree';
import { defaultLocale, defaultVersion, getDocs, getPageTree, scopeOf } from './route-data';

export interface LlmsData {
  sections: LlmsSection[];
  pages: Map<string, LlmsPage>;
}

/** Collect the pages of the default language and version, keyed by their URL. */
export async function getLlmsData(site: URL | undefined): Promise<LlmsData> {
  const [tree, docs] = await Promise.all([
    getPageTree(defaultLocale, defaultVersion),
    getDocs(),
  ]);
  const pages = new Map<string, LlmsPage>();

  for (const entry of docs) {
    const scope = scopeOf(entry.id);
    if (scope.locale.key !== defaultLocale.key || scope.version.key !== defaultVersion.key) continue;
    const path = urlFromId(scope.id, import.meta.env.BASE_URL);
    pages.set(path, {
      title: entry.data.title,
      description: entry.data.description,
      url: site ? new URL(path, site).href : path,
      body: toPlainMarkdown(entry.body ?? ''),
    });
  }

  return { sections: getSections(tree), pages };
}

export const TEXT_HEADERS = { 'content-type': 'text/plain; charset=utf-8' };
export const MARKDOWN_HEADERS = { 'content-type': 'text/markdown; charset=utf-8' };
