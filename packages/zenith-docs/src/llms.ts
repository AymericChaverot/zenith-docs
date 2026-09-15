import { flattenTree, type PageTree } from './page-tree';

export interface LlmsPage {
  title: string;
  description?: string;
  /** Absolute URL when the site has one, a path otherwise. */
  url: string;
  body: string;
}

export interface LlmsSection {
  name?: string;
  urls: string[];
}

/** Drop MDX imports and exports, which are noise outside of a bundler. */
export function toPlainMarkdown(body: string): string {
  return body
    .replace(/^(?:import|export)\s[^\n]*\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Group pages the way the sidebar does: loose pages first, then one section per folder. */
export function getSections(tree: PageTree): LlmsSection[] {
  const sections: LlmsSection[] = [];
  let loose: LlmsSection | undefined;

  for (const node of tree.children) {
    if (node.type === 'separator') {
      loose = { name: node.name, urls: [] };
      sections.push(loose);
      continue;
    }
    if (node.type === 'page') {
      if (node.external) continue;
      if (!loose) {
        loose = { urls: [] };
        sections.push(loose);
      }
      loose.urls.push(node.url);
      continue;
    }
    const urls = [...(node.index ? [node.index] : []), ...flattenTree(node.children)].map(
      (page) => page.url,
    );
    if (urls.length > 0) sections.push({ name: node.name, urls });
  }

  return sections.filter((section) => section.urls.length > 0);
}

interface RenderOptions {
  title: string;
  description?: string;
  sections: LlmsSection[];
  pages: Map<string, LlmsPage>;
}

/** The llms.txt index: a title, a summary and one Markdown link per page. */
export function renderLlmsIndex({ title, description, sections, pages }: RenderOptions): string {
  const lines = [`# ${title}`];
  if (description) lines.push('', `> ${description}`);

  for (const section of sections) {
    lines.push('', `## ${section.name ?? 'Docs'}`, '');
    for (const url of section.urls) {
      const page = pages.get(url);
      if (!page) continue;
      const summary = page.description ? `: ${page.description}` : '';
      lines.push(`- [${page.title}](${page.url})${summary}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/** The llms-full.txt bundle: every page, in reading order. */
export function renderLlmsFull({ title, description, sections, pages }: RenderOptions): string {
  const documents = [`# ${title}`, ...(description ? [`> ${description}`] : [])].join('\n\n');
  const bodies = sections.flatMap((section) =>
    section.urls.flatMap((url) => {
      const page = pages.get(url);
      return page ? [renderPage(page)] : [];
    }),
  );
  return `${[documents, ...bodies].join('\n\n---\n\n')}\n`;
}

/** A single page as standalone Markdown. */
export function renderPage(page: LlmsPage): string {
  return [
    `# ${page.title}`,
    ...(page.description ? [`> ${page.description}`] : []),
    `Source: ${page.url}`,
    page.body,
  ].join('\n\n');
}
