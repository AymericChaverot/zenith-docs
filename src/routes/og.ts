import type { APIRoute, GetStaticPaths } from 'astro';
import config from 'virtual:zenith/config';
import * as assets from 'virtual:zenith/og-assets';
import template from 'virtual:zenith/og-template';
import { renderOgImage } from '../og';
import {
  getDocs,
  getDocsPaths,
  getRouteData,
  hasGeneratedOgImage,
  type DocsEntry,
} from '../route-data';
import { baseUrl } from '../urls';

export const getStaticPaths = (async () => {
  const paths = await getDocsPaths(await getDocs());
  // The home page has no slug, its image is `og/index.png`.
  return paths
    .filter(({ props }) => hasGeneratedOgImage(props.entry))
    .map(({ params, props }) => ({ params: { slug: params.slug ?? 'index' }, props }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { entry, locale, version, translated } = props as {
    entry: DocsEntry;
    locale: string;
    version: string;
    translated: boolean;
  };
  const data = await getRouteData(entry, [], { locale, version, translated });
  const og = entry.data.og || undefined;

  const badges = [
    data.locales.length > 1 ? data.locale.label : undefined,
    data.versions.length > 1 ? data.version.label : undefined,
  ].filter((badge) => badge !== undefined);

  // Folders the page belongs to, falling back to its path, but never a bare `/`.
  const trail = data.breadcrumbs.map((crumb) => crumb.name).join(' / ');
  const home = data.url === baseUrl();

  const png = await renderOgImage({
    config,
    assets,
    title: og?.title ?? data.title,
    description: og?.description ?? data.description,
    section: trail || (home ? undefined : data.url),
    badges,
    url: data.url,
    lang: data.locale.lang,
    template,
  });

  return new Response(png, { headers: { 'content-type': 'image/png' } });
};
