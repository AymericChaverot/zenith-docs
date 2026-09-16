#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { TEMPLATES } from './templates.mjs';

const HELP = `Create a ZenithDocs site

Usage
  npm create zenith-docs [directory] [options]

Options
  -t, --template <name>  cli (default): a config file and a folder of Markdown
                         astro: an Astro project with the integration
      --title <title>    Site title, derived from the directory otherwise
  -h, --help             Show this message
`;

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      template: { type: 'string', short: 't', default: 'cli' },
      title: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const template = TEMPLATES[values.template];
  if (!template) {
    throw new Error(
      `Unknown template \`${values.template}\`. Use one of: ${Object.keys(TEMPLATES).join(', ')}.`,
    );
  }

  const target = resolve(positionals[0] ?? 'zenith-docs');
  // An empty directory, or one holding only dotfiles such as `.git`, is fine.
  if (existsSync(target) && readdirSync(target).some((entry) => !entry.startsWith('.'))) {
    throw new Error(`${target} is not empty. Pick another directory, or empty this one first.`);
  }

  const name = toPackageName(basename(target));
  const title = values.title ?? toTitle(basename(target));

  for (const [path, contents] of Object.entries(template({ name, title }))) {
    const file = join(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }

  const run = packageManager();
  const location = relative(process.cwd(), target) || '.';
  console.log(`
Created ${title} in ${location}, from the ${values.template} template.

Next steps:
${location === '.' ? '' : `  cd ${location}\n`}  ${run} install
  ${run === 'npm' ? 'npm run dev' : `${run} dev`}
`);
}

/** The package manager that ran `create`, so the instructions match it. */
function packageManager() {
  const agent = process.env.npm_config_user_agent ?? '';
  for (const manager of ['pnpm', 'yarn', 'bun']) {
    if (agent.startsWith(manager)) return manager;
  }
  return 'npm';
}

function toPackageName(directory) {
  return (
    directory
      .toLowerCase()
      .replace(/[^a-z0-9-~._]+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '') || 'zenith-docs'
  );
}

/** `my-great-docs` reads better as `My Great Docs`. */
function toTitle(directory) {
  return directory
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
