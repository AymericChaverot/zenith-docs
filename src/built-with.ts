import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export interface BuiltWithEntry {
  /** Name of the project, also the key of its logo in `BuiltWith.astro`. */
  name: 'ZenithDocs' | 'Astro' | 'Pagefind' | 'Shiki';
  version: string;
}

/**
 * Version of an installed package, read from its manifest. The manifest is looked up in
 * the `node_modules` directories Node would search, since packages like Pagefind export
 * neither a CommonJS entry nor their `package.json`.
 */
export function packageVersion(name: string, from: string | URL): string | undefined {
  const require = createRequire(from);
  for (const dir of require.resolve.paths(name) ?? []) {
    const manifest = join(dir, name, 'package.json');
    if (!existsSync(manifest)) continue;
    return (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version;
  }
}

/**
 * The projects a site is built with, and their versions: ZenithDocs itself, the Astro of the
 * project, and the dependencies of ZenithDocs that end up in the pages.
 */
export function getBuiltWith({ root, search }: { root: URL; search: boolean }): BuiltWithEntry[] {
  const manifest = new URL('../package.json', import.meta.url);
  const own = (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
  const entries: { name: BuiltWithEntry['name']; version: string | undefined }[] = [
    { name: 'ZenithDocs', version: own },
    { name: 'Astro', version: packageVersion('astro', new URL('package.json', root)) },
    ...(search ? [{ name: 'Pagefind' as const, version: packageVersion('pagefind', import.meta.url) }] : []),
    { name: 'Shiki', version: packageVersion('shiki', import.meta.url) },
  ];
  return entries.flatMap(({ name, version }) => (version ? [{ name, version }] : []));
}
