#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { create } from './create.mjs';
import { docker } from './docker.mjs';
import { init } from './init.mjs';
import { generateProject, loadProject } from './project.mjs';

const HELP = `zenith — documentation sites, without a build to configure

Usage
  npx github:AymericChaverot/zenith-docs create [directory]
  zenith <command> [options]

Commands
  create     Create a new site in a directory, asking for what it needs
  init       Add a config file and a first page to the current directory
  docker     Add a Dockerfile that builds the site and serves it with nginx
  dev        Start the development server
  build      Build the site into dist/
  preview    Serve the built site

Run \`zenith create --help\` or \`zenith docker --help\` for their options.

Options
  -p, --port <number>   Port of the dev or preview server
      --host <host>     Address to expose the server on
      --open            Open a browser once the server is ready
  -h, --help            Show this message
  -v, --version         Show the version
`;

/** @param {string[]} argv */
async function main(argv) {
  // `create` and `docker` have options of their own, so they parse the rest of the line.
  if (argv[0] === 'create') {
    await create(argv.slice(1));
    return;
  }
  if (argv[0] === 'docker') {
    docker(argv.slice(1), process.cwd());
    return;
  }

  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string' },
      open: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  const command = positionals[0];

  if (values.version) {
    const manifest = new URL('../../package.json', import.meta.url);
    console.log(JSON.parse(readFileSync(manifest, 'utf8')).version);
    return;
  }

  if (values.help || !command) {
    console.log(HELP);
    return;
  }

  const root = process.cwd();

  if (command === 'init') {
    init(root);
    return;
  }

  if (command !== 'dev' && command !== 'build' && command !== 'preview') {
    throw new Error(`Unknown command \`${command}\`. Run \`zenith --help\` to see them all.`);
  }

  const project = await loadProject(root);
  const configFile = generateProject(project);
  const server = {
    ...(values.port ? { port: Number(values.port) } : {}),
    ...(values.host ? { host: values.host } : {}),
    ...(values.open ? { open: true } : {}),
  };

  // Astro resolves the integration from the generated config, so it is imported late.
  const astro = await import('astro');
  const inline = { root, configFile, server };

  if (command === 'dev') await astro.dev(inline);
  else if (command === 'build') await astro.build(inline);
  else await astro.preview(inline);
}

main(process.argv.slice(2)).catch((error) => {
  // Errors are often wrapped, and the useful part is the innermost cause.
  const lines = [];
  for (let current = error; current; current = current instanceof Error ? current.cause : undefined) {
    lines.push(`${lines.length === 0 ? '' : 'Caused by: '}${current instanceof Error ? current.message : String(current)}`);
  }
  console.error(`\n${lines.join('\n')}\n`);
  process.exit(1);
});
