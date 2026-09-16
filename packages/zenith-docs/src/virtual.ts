import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ZenithConfig } from './config';
import type { OgFontWeight } from './og';

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
  'Breadcrumb',
  'PageFooter',
  'Pagination',
  'ThemeToggle',
] as const;

const toPosix = (path: string) => path.replaceAll('\\', '/');

const require = createRequire(import.meta.url);

/** Font weights embedded in Open Graph images, see `og.ts`. */
const OG_FONT_WEIGHTS: OgFontWeight[] = [400, 600];

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

/** Files read while rendering Open Graph images, resolved before the bundle loses names. */
function ogAssets(): string {
  const fonts = OG_FONT_WEIGHTS.map((weight) => ({
    weight,
    path: require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`),
  }));
  const wasm = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
  return `export const fonts = ${JSON.stringify(fonts)};
export const wasm = ${JSON.stringify(wasm)};`;
}

export function vitePluginZenith(
  config: ZenithConfig,
  root: URL,
  shikiThemes: Record<string, string> = {},
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
  };

  if (config.og) modules['virtual:zenith/og-assets'] = ogAssets();
  const external = new Map<string, string>(
    config.og ? EXTERNAL.map((name) => [name, esmEntry(name)]) : [],
  );

  for (const name of OVERRIDABLE_COMPONENTS) {
    const override = config.components[name];
    const path = override
      ? resolveFromRoot(override)
      : toPosix(fileURLToPath(new URL(`./components/layout/${name}.astro`, import.meta.url)));
    modules[`virtual:zenith/components/${name}`] = `export { default } from ${JSON.stringify(path)};`;
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
