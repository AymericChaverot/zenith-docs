// `zenith create`: writes a new site. It runs before anything is installed in the target,
// through `npx`, so it only uses Node built-ins and the dependencies of ZenithDocs itself.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseArgs, styleText } from 'node:util';
import * as p from '@clack/prompts';
import { dockerFiles } from './docker.mjs';
import { TEMPLATES, THEMES } from './templates.mjs';

const HELP = `Create a ZenithDocs site

Usage
  npx github:AymericChaverot/zenith-docs create [directory] [options]

Run it in a terminal without options and it asks for what it needs.

Options
  -t, --template <name>  cli (default) or astro
      --title <title>    Site title, derived from the directory otherwise
      --theme <name>     ${Object.keys(THEMES).join(', ')}
      --docker           Add a Dockerfile that serves the site with nginx
      --install          Install dependencies once the files are written
  -y, --yes              Ask nothing, use the options and the defaults
  -h, --help             Show this message
`;

/** @param {string[]} argv Arguments after `create`. */
export async function create(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      template: { type: 'string', short: 't' },
      title: { type: 'string' },
      theme: { type: 'string' },
      docker: { type: 'boolean' },
      install: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  // Arrow keys need a terminal on both ends: anywhere else, the options and defaults decide.
  const interactive = !values.yes && process.stdin.isTTY === true && process.stdout.isTTY === true;
  const run = packageManager();

  if (values.template && !TEMPLATES[values.template]) {
    throw new Error(
      `Unknown template \`${values.template}\`. Use one of: ${Object.keys(TEMPLATES).join(', ')}.`,
    );
  }
  if (values.theme && values.theme !== 'none' && !THEMES[values.theme]) {
    throw new Error(
      `Unknown theme \`${values.theme}\`. Use one of: ${Object.keys(THEMES).join(', ')}.`,
    );
  }

  // A directory known up front is checked before anything is drawn.
  const given = positionals[0] ?? (interactive ? undefined : 'zenith-docs');
  const problem = given && notEmpty(resolve(given));
  if (problem) throw new Error(problem);

  console.log();
  p.intro(
    `${styleText(['bgGreen', 'black', 'bold'], ' ZenithDocs ')} ${styleText('dim', 'let’s set up your documentation')}`,
  );

  const directory =
    given ??
    answer(
      await p.text({
        message: 'Where should the site go?',
        placeholder: './my-docs',
        defaultValue: 'my-docs',
        validate: (value) => notEmpty(resolve(value || 'my-docs')),
      }),
    );
  const target = resolve(directory);

  const title =
    values.title ??
    (interactive
      ? answer(
          await p.text({
            message: 'What is the site called?',
            placeholder: toTitle(basename(target)),
            defaultValue: toTitle(basename(target)),
          }),
        )
      : toTitle(basename(target)));

  const template =
    values.template ??
    (interactive
      ? answer(
          await p.select({
            message: 'Which template?',
            options: Object.entries(TEMPLATES).map(([name, { description }]) => ({
              value: name,
              label: name,
              hint: description,
            })),
          }),
        )
      : 'cli');

  const theme =
    values.theme ??
    (interactive
      ? answer(
          await p.select({
            message: 'Which theme?',
            options: [
              { value: 'none', label: 'default', hint: 'Keep the defaults' },
              ...Object.entries(THEMES).map(([name, hint]) => ({ value: name, label: name, hint })),
            ],
          }),
        )
      : 'none');

  const withDocker =
    values.docker ??
    (interactive
      ? answer(
          await p.confirm({
            message: 'Add a Dockerfile to serve it with nginx?',
            initialValue: false,
          }),
        )
      : false);

  const install =
    values.install ??
    (interactive
      ? answer(
          await p.confirm({ message: `Install dependencies with ${run}?`, initialValue: true }),
        )
      : false);

  const name = toPackageName(basename(target));
  const files = {
    ...TEMPLATES[template].files({ name, title, theme: theme === 'none' ? undefined : theme }),
    // pnpm refuses to install, outside a terminal, when a dependency's build script is not
    // approved: esbuild, pulled in by Astro, has one.
    ...(run === 'pnpm' ? { 'pnpm-workspace.yaml': 'allowBuilds:\n  esbuild: true\n' } : {}),
    ...(withDocker ? dockerFiles({ packageManager: run }) : {}),
  };
  for (const [path, contents] of Object.entries(files)) {
    const file = join(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }

  const location = relative(process.cwd(), target) || '.';
  p.log.success(
    `Created ${styleText('bold', title)} in ${styleText('cyan', location)}, from the ${template} template.`,
  );

  let installed = false;
  if (install) installed = await installDependencies(run, target);

  const steps = [
    ...(location === '.' ? [] : [`cd ${location}`]),
    ...(installed ? [] : [`${run} install`]),
    run === 'npm' ? 'npm run dev' : `${run} dev`,
  ];
  p.note(steps.map((step) => styleText('cyan', step)).join('\n'), 'Next steps');
  p.outro(
    `Docs are at ${styleText('underline', 'https://aymericchaverot.github.io/zenith-docs/')}`,
  );
}

/**
 * Runs the install, showing its output as it goes: the log clears once it succeeds, and
 * stays on screen when it fails.
 *
 * @param {string} run
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
function installDependencies(run, cwd) {
  // Package managers are `.cmd` shims on Windows, which only a shell can run. The command
  // is one string because `run` comes from a fixed list, so there is nothing to escape.
  const command = `${run} install`;

  // Redrawing the log takes a terminal: a CI log or a file gets the plain output instead.
  if (process.stdout.isTTY !== true) {
    p.log.step(`Installing dependencies with ${run}`);
    return new Promise((done) => {
      spawn(command, { cwd, shell: true, stdio: 'inherit' })
        .on('error', () => done(false))
        .on('close', (code) => {
          if (code !== 0) p.log.error(`The install did not complete. Run \`${command}\` yourself.`);
          done(code === 0);
        });
    });
  }

  const log = p.taskLog({ title: `Installing dependencies with ${run}`, limit: 8 });
  return new Promise((done) => {
    const child = spawn(command, { cwd, shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    const forward = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) log.message(line);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', (error) => {
      log.error(`Could not run ${run}: ${error.message}`);
      done(false);
    });
    child.on('close', (code) => {
      if (code === 0) log.success('Dependencies installed');
      else
        log.error(`The install did not complete. Run \`${command}\` yourself.`, { showLog: true });
      done(code === 0);
    });
  });
}

/** Stops cleanly on Ctrl+C or Escape, before anything is written. */
function answer(value) {
  if (p.isCancel(value)) {
    p.cancel('Nothing was created.');
    process.exit(0);
  }
  return value;
}

/** An empty directory, or one holding only dotfiles such as `.git`, is fine. */
function notEmpty(target) {
  if (existsSync(target) && readdirSync(target).some((entry) => !entry.startsWith('.'))) {
    return `${target} is not empty. Pick another directory, or empty this one first.`;
  }
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
