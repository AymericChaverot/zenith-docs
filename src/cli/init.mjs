import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DEFAULT_DOCS_DIR } from './project.mjs';

const CONFIG = `import { defineConfig } from 'zenith-docs/config';

export default defineConfig({
  title: %TITLE%,
});
`;

const FIRST_PAGE = `---
title: Introduction
description: The first page of the documentation.
---

Welcome. Edit \`${DEFAULT_DOCS_DIR}/index.md\` to change this page, and add more files next to it.
`;

/**
 * Creates a config file and a first page, leaving anything that already exists alone.
 *
 * @param {string} root
 */
export function init(root) {
  /** @type {string[]} */
  const written = [];
  const config = join(root, 'zenith.config.ts');

  if (!existsSync(config)) {
    writeFileSync(config, CONFIG.replace('%TITLE%', JSON.stringify(titleOf(root))));
    written.push('zenith.config.ts');
  }

  const docs = join(root, DEFAULT_DOCS_DIR);
  const page = join(docs, 'index.md');
  if (!existsSync(page)) {
    mkdirSync(docs, { recursive: true });
    writeFileSync(page, FIRST_PAGE);
    written.push(`${DEFAULT_DOCS_DIR}/index.md`);
  }

  console.log(
    written.length > 0
      ? `Created ${written.join(' and ')}.\n\nRun \`zenith dev\` to see it.`
      : 'Nothing to do: the config file and the first page are already there.',
  );
}

/**
 * `my-great-docs` reads better as `My Great Docs`.
 *
 * @param {string} root
 */
function titleOf(root) {
  return basename(root)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
