import './global';

import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSatteriProcessor } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import type { AstroIntegration } from 'astro';
import { fontProviders } from 'astro/config';
import { AstroError } from 'astro/errors';
import { ZenithConfigSchema, type ZenithUserConfig } from './config';
import { getDefaultLocale, localeOf, resolveLocales } from './locales';
import { resolveLogo } from './logo';
import { getTranslations, type Translations } from './translations';
import {
  directivesRestorationPlugin,
  zenithHastPlugins,
  zenithMdastPlugins,
} from './markdown/index';
import { zenithShikiTransformers } from './markdown/shiki';
import { buildSearchIndex } from './search';
import { OVERRIDABLE_COMPONENTS, vitePluginZenith } from './virtual';

export type { ZenithConfig, ZenithUserConfig } from './config';

export default function zenith(userConfig: ZenithUserConfig): AstroIntegration {
  const parsed = ZenithConfigSchema.safeParse(userConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new AstroError('Invalid ZenithDocs configuration', issues.join('\n'));
  }
  const config = parsed.data;

  if (config.locales && !('root' in config.locales)) {
    throw new AstroError(
      'Missing `root` locale',
      'The `locales` option needs a `root` entry: it is the default language, served without a URL prefix.',
    );
  }

  if (config.versions && !('root' in config.versions)) {
    throw new AstroError(
      'Missing `root` version',
      'The `versions` option needs a `root` entry: it is the current version, served without a URL prefix.',
    );
  }

  const unknown = Object.keys(config.components).filter(
    (name) => !(OVERRIDABLE_COMPONENTS as readonly string[]).includes(name),
  );
  if (unknown.length > 0) {
    throw new AstroError(
      `Unknown component override: ${unknown.join(', ')}`,
      `Overridable components are: ${OVERRIDABLE_COMPONENTS.join(', ')}.`,
    );
  }

  let staticOutput = true;

  return {
    name: 'zenith-docs',
    hooks: {
      'astro:config:setup': ({ config: astroConfig, injectRoute, updateConfig, logger }) => {
        staticOutput = astroConfig.output === 'static';

        injectRoute({
          pattern: '404',
          entrypoint: 'zenith-docs/routes/404.astro',
          prerender: true,
        });
        injectRoute({
          pattern: '[...slug]',
          entrypoint: 'zenith-docs/routes/docs.astro',
          prerender: true,
        });

        if (config.llms) {
          for (const [pattern, entrypoint] of [
            ['llms.txt', 'zenith-docs/routes/llms.txt.ts'],
            ['llms-full.txt', 'zenith-docs/routes/llms-full.txt.ts'],
            ['[...slug].md', 'zenith-docs/routes/page.md.ts'],
          ] as const) {
            injectRoute({ pattern, entrypoint, prerender: true });
          }
        }

        // Callout titles and labels follow the language of the file being processed.
        const locales = resolveLocales(config);
        const docsRoot = fileURLToPath(
          new URL(`${config.docsDir.replace(/^\.\//, '').replace(/\/$/, '')}/`, astroConfig.root),
        );
        const cache = new Map<string, Translations>();
        const translationsForFile = (fileURL: URL | undefined) => {
          const path = fileURL ? relative(docsRoot, fileURLToPath(fileURL)) : '';
          const locale =
            path && !path.startsWith('..')
              ? localeOf(path.replaceAll('\\', '/'), locales)
              : getDefaultLocale(locales);
          let translations = cache.get(locale.key);
          if (!translations) {
            translations = getTranslations(locale.lang, config.translations[locale.key]);
            cache.set(locale.key, translations);
          }
          return translations;
        };

        const processor = astroConfig.markdown.processor;
        if (processor && isSatteriProcessor(processor)) {
          processor.options.features.directive = true;
          processor.options.mdastPlugins.push(
            ...zenithMdastPlugins(translationsForFile),
            directivesRestorationPlugin(),
          );
          processor.options.hastPlugins.push(...zenithHastPlugins(translationsForFile));
        } else {
          logger.warn(
            'ZenithDocs Markdown features (callouts, heading anchors, code titles) require the Sätteri processor.',
          );
        }

        const has = (name: string) => astroConfig.integrations.some((i) => i.name === name);
        const integrations: AstroIntegration[] = [];
        if (!has('@astrojs/mdx')) integrations.push(mdx());
        if (astroConfig.site && !has('@astrojs/sitemap')) integrations.push(sitemap());
        const selfIndex = astroConfig.integrations.findIndex((i) => i.name === 'zenith-docs');
        astroConfig.integrations.splice(selfIndex + 1, 0, ...integrations);

        const resolvedConfig = { ...config, logo: resolveLogo(config.logo, astroConfig) };

        const { shikiConfig } = astroConfig.markdown;
        const hasUserThemes = Object.keys(shikiConfig.themes ?? {}).length > 0;
        updateConfig({
          markdown: {
            shikiConfig: {
              ...(hasUserThemes ? {} : { themes: { light: 'vitesse-light', dark: 'vitesse-dark' } }),
              defaultColor: false,
              transformers: zenithShikiTransformers(),
            },
          },
          fonts: config.fonts
            ? [
                {
                  provider: fontProviders.fontsource(),
                  name: 'Geist',
                  cssVariable: '--zd-font-sans',
                  weights: ['100 900'],
                  styles: ['normal'],
                  subsets: ['latin'],
                  fallbacks: ['system-ui', 'sans-serif'],
                },
                {
                  provider: fontProviders.fontsource(),
                  name: 'Geist Mono',
                  cssVariable: '--zd-font-mono',
                  weights: ['100 900'],
                  styles: ['normal'],
                  subsets: ['latin'],
                  fallbacks: ['ui-monospace', 'monospace'],
                },
              ]
            : [],
          vite: {
            plugins: [vitePluginZenith(resolvedConfig, astroConfig.root)],
          },
        });
      },

      'astro:build:done': async ({ dir, logger }) => {
        if (!config.search) return;
        if (!staticOutput) {
          logger.warn('Search is only built for static output, skipping the index.');
          return;
        }
        await buildSearchIndex(dir, logger);
      },
    },
  };
}
