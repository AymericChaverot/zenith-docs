#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { TEMPLATES, THEMES } from './templates.mjs';

const HELP = `Create a ZenithDocs site

Usage
  npm create zenith-docs [directory] [options]

Run it in a terminal without options and it asks for what it needs.

Options
  -t, --template <name>  cli (default) or astro
      --title <title>    Site title, derived from the directory otherwise
      --theme <name>     ${Object.keys(THEMES).join(', ')}
      --install          Install dependencies once the files are written
  -y, --yes              Ask nothing, use the options and the defaults
  -h, --help             Show this message
`;

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      template: { type: 'string', short: 't' },
      title: { type: 'string' },
      theme: { type: 'string' },
      install: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      // Forces the questions when input is piped, which is how they are tested.
      interactive: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const interactive = !values.yes && (values.interactive || process.stdin.isTTY === true);
  const prompt = interactive ? createPrompt() : undefined;
  const run = packageManager();

  if (interactive) console.log('\n  ZenithDocs — let’s set up your documentation.\n');

  const directory =
    positionals[0] ?? (prompt ? await prompt.text('Where should the site go?', 'my-docs') : 'zenith-docs');
  const target = resolve(directory);
  // An empty directory, or one holding only dotfiles such as `.git`, is fine.
  if (existsSync(target) && readdirSync(target).some((entry) => !entry.startsWith('.'))) {
    prompt?.close();
    throw new Error(`${target} is not empty. Pick another directory, or empty this one first.`);
  }

  const title =
    values.title ?? (prompt ? await prompt.text('Site title', toTitle(basename(target))) : toTitle(basename(target)));

  const template =
    values.template ??
    (prompt
      ? await prompt.choice(
          'Template',
          Object.entries(TEMPLATES).map(([name, { description }]) => [name, description]),
        )
      : 'cli');
  if (!TEMPLATES[template]) {
    prompt?.close();
    throw new Error(`Unknown template \`${template}\`. Use one of: ${Object.keys(TEMPLATES).join(', ')}.`);
  }

  const theme =
    values.theme ??
    (prompt ? await prompt.choice('Theme', [['none', 'Keep the defaults'], ...Object.entries(THEMES)]) : 'none');
  if (theme !== 'none' && !THEMES[theme]) {
    prompt?.close();
    throw new Error(`Unknown theme \`${theme}\`. Use one of: ${Object.keys(THEMES).join(', ')}.`);
  }

  const install =
    values.install ?? (prompt ? await prompt.confirm(`Install dependencies with ${run}?`, true) : false);
  prompt?.close();

  const name = toPackageName(basename(target));
  const files = TEMPLATES[template].files({ name, title, theme: theme === 'none' ? undefined : theme });
  for (const [path, contents] of Object.entries(files)) {
    const file = join(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }

  const location = relative(process.cwd(), target) || '.';
  console.log(`\n  Created ${title} in ${location}, from the ${template} template.`);

  let installed = false;
  if (install) {
    console.log(`\n  Installing dependencies with ${run}…\n`);
    // Package managers are `.cmd` shims on Windows, which only a shell can run. The command
    // is one string because `run` comes from a fixed list, so there is nothing to escape.
    const result = spawnSync(`${run} install`, { cwd: target, stdio: 'inherit', shell: true });
    installed = result.status === 0;
    if (!installed) console.log(`\n  The install did not complete. Run it yourself from ${location}.`);
  }

  console.log(`
  Next steps:
${location === '.' ? '' : `    cd ${location}\n`}${installed ? '' : `    ${run} install\n`}    ${run === 'npm' ? 'npm run dev' : `${run} dev`}
`);
}

/**
 * Questions read line by line, so they work in any terminal and with piped input.
 * An exhausted input answers every remaining question with its default.
 */
function createPrompt() {
  const lines = createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();

  const read = async (question) => {
    process.stdout.write(question);
    const { value, done } = await lines.next();
    if (!process.stdin.isTTY) process.stdout.write(`${done ? '' : value}\n`);
    return done ? '' : value.trim();
  };

  return {
    async text(label, fallback) {
      return (await read(`  ◆ ${label} (${fallback}) `)) || fallback;
    },

    async choice(label, choices) {
      const width = Math.max(...choices.map(([name]) => name.length));
      console.log(`  ◆ ${label}`);
      choices.forEach(([name, description], index) => {
        console.log(`      ${index + 1}. ${name.padEnd(width)}  ${description}`);
      });
      for (;;) {
        const answer = await read(`    Choose 1-${choices.length} (1) `);
        if (!answer) return choices[0][0];
        const byNumber = choices[Number(answer) - 1];
        const byName = choices.find(([name]) => name === answer);
        if (byNumber || byName) return (byNumber ?? byName)[0];
        console.log(`    “${answer}” is not one of the choices.`);
      }
    },

    async confirm(label, fallback) {
      const answer = (await read(`  ◆ ${label} (${fallback ? 'Y/n' : 'y/N'}) `)).toLowerCase();
      return answer ? answer.startsWith('y') : fallback;
    },

    close() {
      lines.return?.();
    },
  };
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

main(process.argv.slice(2)).catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
