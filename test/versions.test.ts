import { describe, expect, it } from 'vitest';
import type { ZenithConfig } from '../src/config';
import { getDefaultVersion, resolveVersions, stripVersion, versionOf } from '../src/versions';

const config = (versions?: ZenithConfig['versions']) => ({ versions }) as unknown as ZenithConfig;

describe('resolveVersions', () => {
  it('returns a single unnamed version by default', () => {
    expect(resolveVersions(config())).toEqual([{ key: 'root', label: '', prefix: '' }]);
  });

  it('resolves labels, badges and prefixes', () => {
    const versions = resolveVersions(
      config({ root: { label: 'v2', badge: 'Latest' }, v1: { label: 'v1' } }),
    );
    expect(versions).toEqual([
      { key: 'root', label: 'v2', badge: 'Latest', prefix: '' },
      { key: 'v1', label: 'v1', badge: undefined, prefix: 'v1/' },
    ]);
    expect(getDefaultVersion(versions).label).toBe('v2');
  });
});

describe('paths', () => {
  const versions = resolveVersions(config({ root: { label: 'v2' }, v1: { label: 'v1' } }));
  const v1 = versions[1]!;

  it('detects the version of a path', () => {
    expect(versionOf('v1/guides/intro', versions).key).toBe('v1');
    expect(versionOf('guides/intro', versions).key).toBe('root');
  });

  it('strips the version prefix, index page included', () => {
    expect(stripVersion('v1/guides/intro', v1)).toBe('guides/intro');
    expect(stripVersion('v1', v1)).toBe('index');
    expect(stripVersion('guides/intro', versions[0]!)).toBe('guides/intro');
  });
});
