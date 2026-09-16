import type { APIRoute, GetStaticPaths } from 'astro';
import { renderPage, toPlainMarkdown } from '../llms';
import { MARKDOWN_HEADERS } from '../llms-data';
import { urlFromId } from '../page-tree';
import { getDocs, type DocsEntry } from '../route-data';

export const getStaticPaths = (async () => {
  const docs = await getDocs();
  return docs.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => {
  const { entry } = props as { entry: DocsEntry };
  const path = urlFromId(entry.id, import.meta.env.BASE_URL);
  const body = renderPage({
    title: entry.data.title,
    description: entry.data.description,
    url: site ? new URL(path, site).href : path,
    body: toPlainMarkdown(entry.body ?? ''),
  });
  return new Response(body, { headers: MARKDOWN_HEADERS });
};
