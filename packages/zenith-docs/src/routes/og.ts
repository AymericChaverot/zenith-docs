import type { APIRoute, GetStaticPaths } from 'astro';
import config from 'virtual:zenith/config';
import * as assets from 'virtual:zenith/og-assets';
import { renderOgImage } from '../og';
import { getDocs, getDocsPaths, getRouteData, type DocsEntry } from '../route-data';

export const getStaticPaths = (async () => {
  const paths = await getDocsPaths(await getDocs());
  // The home page has no slug, its image is `og/index.png`.
  return paths.map(({ params, props }) => ({ params: { slug: params.slug ?? 'index' }, props }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { entry, locale, version, translated } = props as {
    entry: DocsEntry;
    locale: string;
    version: string;
    translated: boolean;
  };
  const data = await getRouteData(entry, [], { locale, version, translated });

  const badges = [
    data.locales.length > 1 ? data.locale.label : undefined,
    data.versions.length > 1 ? data.version.label : undefined,
  ].filter((badge) => badge !== undefined);

  // Folders the page belongs to, falling back to its path, but never a bare `/`.
  const trail = data.breadcrumbs.map((crumb) => crumb.name).join(' / ');
  const home = data.url === import.meta.env.BASE_URL;

  const png = await renderOgImage({
    config,
    assets,
    title: data.title,
    description: data.description,
    section: trail || (home ? undefined : data.url),
    badges,
  });

  return new Response(png, { headers: { 'content-type': 'image/png' } });
};
