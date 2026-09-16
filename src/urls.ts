/**
 * Prefix a root-relative URL, such as `/logo.png`, with the base the site is served from.
 * Full URLs, protocol-relative URLs and relative paths are returned as they are.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}
