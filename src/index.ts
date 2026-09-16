import './global';

import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSatteriProcessor } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import type { AstroIntegration } from 'astro';
import { fontProviders } from 'astro/config';
import { AstroError } from 'astro/errors';
import { ZenithConfigSchema, type ZenithConfig, type ZenithUserConfig } from './config';
import { FONT_PRESETS, FONT_VARIABLES, type FontFamily, type FontPreset } from './fonts';
import { THEMED_OPTIONS, THEMES } from './themes';
import { getDefaultLocale, localeOf, resolveLocales } from './locales';
import { resolveFavicon, resolveLogo } from './logo';
import { getTranslations, type Translations } from './translations';
import {
  directivesRestorationPlugin,
  zenithHastPlugins,
  zenithMdastPlugins,
} from './markdown/index';
import { zenithShikiTransformers } from './markdown/shiki';
import { buildSearchIndex } from './search';
import { OVERRIDABLE_COMPONENTS, SLOT_NAMES, vitePluginZenith } from './virtual';

export type { ZenithConfig, ZenithUserConfig } from './config';

export default function zenith(userConfig: ZenithUserConfig = {}): AstroIntegration {
  const parsed = ZenithConfigSchema.safeParse(userConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new AstroError('Invalid ZenithDocs configuration', issues.join('\n'));
  }
  const config = parsed.data;

  // A theme only fills the options left unset: zod has already applied its own
  // defaults, so the raw config is what says whether the author chose a value.
  if (config.theme) {
    const theme = THEMES[config.theme];
    for (const option of THEMED_OPTIONS) {
      const value = theme[option as keyof typeof theme];
      if (!(option in userConfig) && value !== undefined) {
        Object.assign(config, { [option]: value });
      }
    }
  }

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

  const unknownSlots = Object.keys(config.slots).filter(
    (name) => !(SLOT_NAMES as readonly string[]).includes(name),
  );
  if (unknownSlots.length > 0) {
    throw new AstroError(
      `Unknown slot: ${unknownSlots.join(', ')}`,
      `Available slots are: ${SLOT_NAMES.join(', ')}.`,
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

        const { favicon, serveDefault } = resolveFavicon(config.favicon, astroConfig);
        if (serveDefault) {
          injectRoute({
            pattern: 'favicon.svg',
            entrypoint: 'zenith-docs/routes/favicon.svg.ts',
            prerender: true,
          });
        }

        if (config.og) {
          injectRoute({
            pattern: 'og/[...slug].png',
            entrypoint: 'zenith-docs/routes/og.ts',
            prerender: true,
          });
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

        const resolvedConfig: ZenithConfig = {
          ...config,
          logo: resolveLogo(config.logo, astroConfig),
          favicon,
        };

        // One entry per family of the preset, under the variables the theme reads.
        const preset: FontPreset | undefined = config.fonts ? FONT_PRESETS[config.fonts] : undefined;
        const fontFamily = (family: FontFamily, cssVariable: string) => ({
          provider: fontProviders.fontsource(),
          name: family.name,
          cssVariable,
          weights: family.weights,
          styles: family.styles ?? ['normal'],
          subsets: ['latin'],
          fallbacks: family.fallbacks,
        });
        const fonts = preset
          ? [
              fontFamily(preset.sans, FONT_VARIABLES.sans),
              fontFamily(preset.mono, FONT_VARIABLES.mono),
              ...(preset.display ? [fontFamily(preset.display, FONT_VARIABLES.display)] : []),
            ]
          : [];

        const { shikiConfig } = astroConfig.markdown;
        const hasUserThemes = Object.keys(shikiConfig.themes ?? {}).length > 0;
        // API samples are highlighted outside the Markdown pipeline, with the same themes.
        const shikiThemes = hasUserThemes
          ? (shikiConfig.themes as Record<string, string>)
          : { light: 'vitesse-light', dark: 'vitesse-dark' };

        updateConfig({
          markdown: {
            shikiConfig: {
              ...(hasUserThemes ? {} : { themes: { light: 'vitesse-light', dark: 'vitesse-dark' } }),
              defaultColor: false,
              transformers: zenithShikiTransformers(),
            },
          },
          fonts,
          vite: {
            plugins: [vitePluginZenith(resolvedConfig, astroConfig.root, shikiThemes)],
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
