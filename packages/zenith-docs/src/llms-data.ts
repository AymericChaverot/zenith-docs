import { getSections, toPlainMarkdown, type LlmsPage, type LlmsSection } from './llms';
import { urlFromId } from './page-tree';
import { getDocs, getPageTree } from './route-data';

export interface LlmsData {
  sections: LlmsSection[];
  pages: Map<string, LlmsPage>;
}

/** Collect every page, keyed by the URL used in the navigation tree. */
export async function getLlmsData(site: URL | undefined): Promise<LlmsData> {
  const [tree, docs] = await Promise.all([getPageTree(), getDocs()]);
  const pages = new Map<string, LlmsPage>();

  for (const entry of docs) {
    const path = urlFromId(entry.id, import.meta.env.BASE_URL);
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
