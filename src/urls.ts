/**
 * The base the site is served from, always ending with a slash: `/` or `/docs/`.
 * Astro gives `BASE_URL` with or without it, depending on how `base` is written.
 */
export function baseUrl(base: string = import.meta.env.BASE_URL): string {
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Prefix a root-relative URL, such as `/logo.png`, with the base the site is served from.
 * Full URLs, protocol-relative URLs, relative paths, and URLs that already carry the base
 * are returned as they are.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = baseUrl(base);
  if (prefix === '/' || path.startsWith(prefix) || `${path}/` === prefix) return path;
  return `${prefix.slice(0, -1)}${path}`;
}
