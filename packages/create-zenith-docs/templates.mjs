/**
 * Files of a new site, as `path → contents`. Plain JavaScript on purpose: this runs
 * before anything is installed, so it can neither import ZenithDocs nor rely on Node
 * reading TypeScript.
 */

const ASTRO_VERSION = '^7.3.2';
const ZENITH_VERSION = 'latest';

const firstPage = (docsDir) => `---
title: Introduction
description: The first page of the documentation.
---

Welcome to your documentation. Edit \`${docsDir}/index.md\` to change this page.

## Next steps

- Add pages next to this one: every Markdown file becomes a page.
- Order them with a \`meta.json\` file in the same folder.
- Run the development server and watch changes as you save.
`;

const guidePage = `---
title: Writing pages
description: Markdown, code blocks and callouts, with nothing to import.
---

:::tip
Callouts, code blocks with titles and GitHub alerts all work out of the box.
:::

\`\`\`ts title="hello.ts"
export const hello = (name: string) => \`Hello \${name}\`;
\`\`\`
`;

const meta = `{
  "pages": ["index", "writing"]
}
`;

const gitignore = `node_modules/
dist/
.astro/
.zenith/
`;

/** A config file and a folder of Markdown, run by the `zenith` CLI. */
function cli({ name, title }) {
  return {
    'package.json': `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: { dev: 'zenith dev', build: 'zenith build', preview: 'zenith preview' },
        dependencies: { astro: ASTRO_VERSION, 'zenith-docs': ZENITH_VERSION },
      },
      null,
      2,
    )}\n`,
    'zenith.config.ts': `import { defineConfig } from 'zenith-docs/config';

export default defineConfig({
  title: ${JSON.stringify(title)},
});
`,
    'content/index.md': firstPage('content'),
    'content/writing.md': guidePage,
    'content/meta.json': meta,
    '.gitignore': gitignore,
  };
}

/** An Astro project with the integration, for sites that need more than documentation. */
function astro({ name, title }) {
  return {
    'package.json': `${JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
        dependencies: { astro: ASTRO_VERSION, 'zenith-docs': ZENITH_VERSION },
      },
      null,
      2,
    )}\n`,
    'astro.config.mjs': `// @ts-check
import { defineConfig } from 'astro/config';
import zenith from 'zenith-docs';

export default defineConfig({
  integrations: [
    zenith({
      title: ${JSON.stringify(title)},
    }),
  ],
});
`,
    'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docsLoader, docsSchema, metaLoader, metaSchema } from 'zenith-docs/content';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  meta: defineCollection({ loader: metaLoader(), schema: metaSchema() }),
};
`,
    'src/content/docs/index.md': firstPage('src/content/docs'),
    'src/content/docs/writing.md': guidePage,
    'src/content/docs/meta.json': meta,
    'tsconfig.json': `{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
`,
    '.gitignore': gitignore,
  };
}

export const TEMPLATES = { cli, astro };
