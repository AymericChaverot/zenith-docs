import './global';

import { isSatteriProcessor } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import { ZenithConfigSchema, type ZenithUserConfig } from './config';
import {
  directivesRestorationPlugin,
  zenithHastPlugins,
  zenithMdastPlugins,
} from './markdown/index';
import { zenithShikiTransformers } from './markdown/shiki';
import { OVERRIDABLE_COMPONENTS, vitePluginZenith } from './virtual';

export type { ZenithConfig, ZenithUserConfig } from './config';

export default function zenith(userConfig: ZenithUserConfig): AstroIntegration {
  const parsed = ZenithConfigSchema.safeParse(userConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new AstroError('Invalid ZenithDocs configuration', issues.join('\n'));
  }
  const config = parsed.data;

  const unknown = Object.keys(config.components).filter(
    (name) => !(OVERRIDABLE_COMPONENTS as readonly string[]).includes(name),
  );
  if (unknown.length > 0) {
    throw new AstroError(
      `Unknown component override: ${unknown.join(', ')}`,
      `Overridable components are: ${OVERRIDABLE_COMPONENTS.join(', ')}.`,
    );
  }

  return {
    name: 'zenith-docs',
    hooks: {
      'astro:config:setup': ({ config: astroConfig, injectRoute, updateConfig, logger }) => {
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

        const processor = astroConfig.markdown.processor;
        if (processor && isSatteriProcessor(processor)) {
          processor.options.features.directive = true;
          processor.options.mdastPlugins.push(...zenithMdastPlugins(), directivesRestorationPlugin());
          processor.options.hastPlugins.push(...zenithHastPlugins());
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

        const { shikiConfig } = astroConfig.markdown;
        const hasUserThemes = Object.keys(shikiConfig.themes ?? {}).length > 0;
        updateConfig({
          markdown: {
            shikiConfig: {
              ...(hasUserThemes ? {} : { themes: { light: 'github-light', dark: 'github-dark' } }),
              defaultColor: false,
              transformers: zenithShikiTransformers(),
            },
          },
          vite: {
            plugins: [vitePluginZenith(config, astroConfig.root)],
          },
        });
      },
    },
  };
}
