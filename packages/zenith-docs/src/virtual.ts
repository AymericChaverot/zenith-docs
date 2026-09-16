import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZenithConfig } from './config';

/** Layout components that can be replaced through the `components` option. */
export const OVERRIDABLE_COMPONENTS = [
  'Head',
  'Header',
  'LocaleSwitcher',
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

export function vitePluginZenith(config: ZenithConfig, root: URL) {
  const rootPath = fileURLToPath(root);
  const resolveFromRoot = (path: string) =>
    path.startsWith('.') || path.startsWith('/') ? toPosix(resolve(rootPath, path)) : path;

  const modules: Record<string, string> = {
    'virtual:zenith/config': `export default ${JSON.stringify(config)};`,
    'virtual:zenith/project': `export const root = ${JSON.stringify(toPosix(rootPath))};`,
    'virtual:zenith/user-css': config.customCss
      .map((path) => `import ${JSON.stringify(resolveFromRoot(path))};`)
      .join('\n'),
  };

  for (const name of OVERRIDABLE_COMPONENTS) {
    const override = config.components[name];
    const path = override
      ? resolveFromRoot(override)
      : toPosix(fileURLToPath(new URL(`./components/layout/${name}.astro`, import.meta.url)));
    modules[`virtual:zenith/components/${name}`] = `export { default } from ${JSON.stringify(path)};`;
  }

  return {
    name: 'zenith-docs:virtual-modules',
    resolveId(id: string) {
      if (id in modules) return `\0${id}`;
    },
    load(id: string) {
      if (id.startsWith('\0virtual:zenith/')) return modules[id.slice(1)];
    },
  };
}
