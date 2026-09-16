/**
 * Files of a new site, as `path → contents`. Plain JavaScript on purpose: this runs
 * before anything is installed, so it can neither import ZenithDocs nor rely on Node
 * reading TypeScript.
 */

import { readFileSync } from 'node:fs';

const ASTRO_VERSION = '^7.3.2';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

/**
 * ZenithDocs is not on the npm registry: it installs straight from its GitHub repository,
 * whose root is the package. New sites are pinned to the release tag of the version that
 * created them, so later changes on `main` never break them. `ZENITH_DOCS_SOURCE` points
 * elsewhere, for a fork or a local copy.
 */
export const ZENITH_VERSION =
  process.env.ZENITH_DOCS_SOURCE ?? `github:AymericChaverot/zenith-docs#v${version}`;

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

/** Options written into the generated config, one per line, indented to fit. */
const configLines = ({ title, theme }, indent) =>
  [`title: ${JSON.stringify(title)},`, ...(theme ? [`theme: ${JSON.stringify(theme)},`] : [])]
    .map((line) => `${indent}${line}`)
    .join('\n');

const gitignore = `node_modules/
dist/
.astro/
.zenith/
`;

/** A config file and a folder of Markdown, run by the `zenith` CLI. */
function cli({ name, title, theme }) {
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
${configLines({ title, theme }, '  ')}
});
`,
    'content/index.md': firstPage('content'),
    'content/writing.md': guidePage,
    'content/meta.json': meta,
    '.gitignore': gitignore,
  };
}

/** An Astro project with the integration, for sites that need more than documentation. */
function astro({ name, title, theme }) {
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
${configLines({ title, theme }, '      ')}
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

export const TEMPLATES = {
  cli: { description: 'A config file and a folder of Markdown, run by the zenith CLI', files: cli },
  astro: { description: 'An Astro project with the integration, for more than docs', files: astro },
};

/** Packaged themes of ZenithDocs, kept in sync by hand since nothing can be imported yet. */
export const THEMES = {
  zenith: 'Emerald, dither backdrop, Instrument fonts: the defaults',
  slate: 'Neutral and sober, squarer corners',
  terminal: 'Teal, sharp corners, a technical face',
  paper: 'Amber, a serif for reading, roomy',
  aurora: 'Violet, soft colour fields, rounded',
};
