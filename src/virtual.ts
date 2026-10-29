import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BuiltWithEntry } from './built-with';
import type { ZenithConfig } from './config';
import type { OgAssets } from './og';

/** Layout components that can be replaced through the `components` option. */
export const OVERRIDABLE_COMPONENTS = [
  'Head',
  'Header',
  'LocaleSwitcher',
  'VersionSwitcher',
  'Search',
  'Sidebar',
  'TableOfContents',
  'PageTitle',
  'PageActions',
  'Breadcrumb',
  'PageFooter',
  'Pagination',
  'ThemeToggle',
] as const;

/** Places of the layout where components can be added through the `slots` option. */
export const SLOT_NAMES = [
  'head',
  'banner',
  'headerEnd',
  'sidebarTop',
  'sidebarBottom',
  'contentBefore',
  'contentAfter',
  'tocAfter',
  'footer',
] as const;

export type SlotName = (typeof SLOT_NAMES)[number];

const toPosix = (path: string) => path.replaceAll('\\', '/');

/** One import per component, grouped by slot, so empty slots cost nothing. */
export function slotsModule(
  slots: Record<string, string | string[]>,
  resolvePath: (path: string) => string,
): string {
  const imports: string[] = [];
  const entries: string[] = [];
  for (const name of SLOT_NAMES) {
    const ids = [slots[name] ?? []].flat().map((path) => {
      const id = `Slot${imports.length}`;
      imports.push(`import ${id} from ${JSON.stringify(resolvePath(path))};`);
      return id;
    });
    entries.push(`  ${name}: [${ids.join(', ')}],`);
  }
  return [...imports, `export default {\n${entries.join('\n')}\n};`].join('\n');
}

const require = createRequire(import.meta.url);

/**
 * satori shapes text with harfbuzz, an Emscripten module that reads `__dirname` and
 * loads its `.wasm` file from its own directory, so it breaks as soon as it is bundled.
 * These two stay out of the bundle and are imported from where they are installed,
 * which holds because images are only ever rendered at build time.
 */
const EXTERNAL = ['satori', '@resvg/resvg-wasm'];

/**
 * Absolute ESM entry of a dependency. `require.resolve` returns its CommonJS build,
 * whose default export Node would not unwrap, so the entry comes from the manifest.
 */
function esmEntry(name: string): string {
  let root = dirname(require.resolve(name));
  while (!existsSync(join(root, 'package.json'))) root = dirname(root);

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    exports?: Record<string, { import?: string | { default?: string } } | undefined>;
    module?: string;
    main?: string;
  };
  const exported = manifest.exports?.['.']?.import;
  const entry = (typeof exported === 'string' ? exported : exported?.default) ?? manifest.module;
  if (!entry) throw new Error(`${name} has no ESM entry point.`);
  return pathToFileURL(join(root, entry)).href;
}

export function vitePluginZenith(
  config: ZenithConfig,
  root: URL,
  shikiThemes: Record<string, string> = {},
  builtWith: BuiltWithEntry[] = [],
  ogAssets?: OgAssets,
) {
  const rootPath = fileURLToPath(root);
  const resolveFromRoot = (path: string) =>
    path.startsWith('.') || path.startsWith('/') ? toPosix(resolve(rootPath, path)) : path;

  const modules: Record<string, string> = {
    'virtual:zenith/config': `export default ${JSON.stringify(config)};`,
    'virtual:zenith/project': `export const root = ${JSON.stringify(toPosix(rootPath))};
export const shikiThemes = ${JSON.stringify(shikiThemes)};`,
    'virtual:zenith/user-css': config.customCss
      .map((path) => `import ${JSON.stringify(resolveFromRoot(path))};`)
      .join('\n'),
    'virtual:zenith/slots': slotsModule(config.slots, resolveFromRoot),
    'virtual:zenith/og-template':
      config.og && config.og.template
        ? `export { default } from ${JSON.stringify(resolveFromRoot(config.og.template))};`
        : 'export default undefined;',
    'virtual:zenith/built-with': `export default ${JSON.stringify(builtWith)};`,
  };

  if (ogAssets) {
    modules['virtual:zenith/og-assets'] = Object.entries(ogAssets)
      .map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`)
      .join('\n');
  }
  const external = new Map<string, string>(
    ogAssets ? EXTERNAL.map((name) => [name, esmEntry(name)]) : [],
  );

  for (const name of OVERRIDABLE_COMPONENTS) {
    const override = config.components[name];
    const path = override
      ? resolveFromRoot(override)
      : toPosix(fileURLToPath(new URL(`./components/layout/${name}.astro`, import.meta.url)));
    modules[`virtual:zenith/components/${name}`] =
      `export { default } from ${JSON.stringify(path)};`;
  }

  return {
    name: 'zenith-docs:virtual-modules',
    // Resolve before Vite, which would otherwise pull the externals into the bundle.
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id in modules) return `\0${id}`;
      const entry = external.get(id);
      if (entry) return { id: entry, external: true };
    },
    load(id: string) {
      if (id.startsWith('\0virtual:zenith/')) return modules[id.slice(1)];
    },
  };
}
