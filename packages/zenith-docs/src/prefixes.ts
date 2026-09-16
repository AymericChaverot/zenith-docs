/**
 * Locales and versions both live in a content directory that doubles as a URL prefix, with a
 * `root` key meaning "no prefix". They share the path handling below.
 */
export interface PrefixedSegment {
  /** Directory name and URL prefix. `root` means none. */
  key: string;
  /** `''` for the root segment, `'fr/'` otherwise. */
  prefix: string;
}

export function resolvePrefix(key: string): string {
  return key === 'root' ? '' : `${key}/`;
}

/** The segment a content path belongs to, based on its first directory. */
export function segmentOf<T extends PrefixedSegment>(path: string, segments: T[], fallback: T): T {
  const first = path.split('/')[0];
  return segments.find((segment) => segment.prefix && segment.key === first) ?? fallback;
}

/**
 * Remove a segment prefix from a content path. The index page of a segment directory has the
 * segment itself as its id, so `fr` becomes `index`.
 */
export function stripSegment(path: string, segment: PrefixedSegment): string {
  if (!segment.prefix) return path;
  if (path === segment.key) return 'index';
  return path.startsWith(segment.prefix) ? path.slice(segment.prefix.length) : path;
}
