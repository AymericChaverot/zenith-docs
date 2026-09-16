import { getSections, toPlainMarkdown, type LlmsPage, type LlmsSection } from './llms';
import { localeOf, stripLocale } from './locales';
import { urlFromId } from './page-tree';
import { defaultLocale, getDocs, getPageTree, locales } from './route-data';

export interface LlmsData {
  sections: LlmsSection[];
  pages: Map<string, LlmsPage>;
}

/** Collect the pages of the default language, keyed by the URL used in the navigation tree. */
export async function getLlmsData(site: URL | undefined): Promise<LlmsData> {
  const [tree, docs] = await Promise.all([getPageTree(defaultLocale), getDocs()]);
  const pages = new Map<string, LlmsPage>();

  for (const entry of docs) {
    if (localeOf(entry.id, locales).key !== defaultLocale.key) continue;
    const path = urlFromId(stripLocale(entry.id, defaultLocale), import.meta.env.BASE_URL);
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
