import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getBuiltWith, packageVersion } from '../src/built-with';

const root = pathToFileURL(`${process.cwd()}/`);
const version = (name: string) =>
  JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version;

describe('packageVersion', () => {
  it('reads packages that do not export their manifest', () => {
    expect(packageVersion('pagefind', import.meta.url)).toBe(version('pagefind'));
  });

  it('returns nothing for a missing package', () => {
    expect(packageVersion('not-a-real-package', import.meta.url)).toBeUndefined();
  });
});

describe('getBuiltWith', () => {
  it('lists ZenithDocs first, then Astro and the dependencies', () => {
    const entries = getBuiltWith({ root, search: true });
    expect(entries.map((entry) => entry.name)).toEqual(['ZenithDocs', 'Astro', 'Pagefind', 'Shiki']);
    expect(entries[0]?.version).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
    expect(entries[1]?.version).toBe(version('astro'));
  });

  it('leaves Pagefind out when search is off', () => {
    const names = getBuiltWith({ root, search: false }).map((entry) => entry.name);
    expect(names).not.toContain('Pagefind');
  });
});
