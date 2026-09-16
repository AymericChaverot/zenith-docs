import type { ZenithConfig } from './config';
import { resolvePrefix, segmentOf, stripSegment, type PrefixedSegment } from './prefixes';

export interface ResolvedVersion extends PrefixedSegment {
  label: string;
  /** Shown next to the label, for example `Latest`. */
  badge?: string;
}

export function resolveVersions(config: ZenithConfig): ResolvedVersion[] {
  if (!config.versions) return [{ key: 'root', label: '', prefix: '' }];
  return Object.entries(config.versions).map(([key, version]) => ({
    key,
    label: version.label,
    badge: version.badge,
    prefix: resolvePrefix(key),
  }));
}

export function getDefaultVersion(versions: ResolvedVersion[]): ResolvedVersion {
  return versions.find((version) => version.key === 'root') ?? versions[0]!;
}

export function getVersion(versions: ResolvedVersion[], key: string): ResolvedVersion {
  return versions.find((version) => version.key === key) ?? getDefaultVersion(versions);
}

/** The version a content path belongs to, based on its first segment. */
export function versionOf(path: string, versions: ResolvedVersion[]): ResolvedVersion {
  return segmentOf(path, versions, getDefaultVersion(versions));
}

/** Remove the version prefix from a content path. */
export function stripVersion(path: string, version: ResolvedVersion): string {
  return stripSegment(path, version);
}
