import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The CLI and `zenith-docs/config` run under plain Node, from `node_modules` once the
 * package is installed. Node refuses to strip types there, so those entry points must be
 * JavaScript. Loading them from the workspace would not show it, hence a real copy.
 */
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
let project: string;

const run = (code: string) =>
  execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: project,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'zenith-installed-'));
  const installed = join(project, 'node_modules', 'zenith-docs');
  cpSync(join(packageRoot, 'package.json'), join(installed, 'package.json'));
  cpSync(join(packageRoot, 'src'), join(installed, 'src'), { recursive: true });
  writeFileSync(join(project, 'package.json'), '{ "type": "module" }');
});

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('the package, installed in node_modules', () => {
  it('runs defineConfig from zenith-docs/config', () => {
    const output = run(
      "const { defineConfig } = await import('zenith-docs/config'); console.log(defineConfig({ title: 'x', theme: 'paper' }).theme);",
    );
    expect(output).toBe('paper');
  });

  it('loads the CLI modules', () => {
    const output = run(
      "await import('./node_modules/zenith-docs/src/cli/project.mjs'); await import('./node_modules/zenith-docs/src/cli/init.mjs'); console.log('ok');",
    );
    expect(output).toBe('ok');
  });

  it('prints the CLI version', () => {
    const output = run(
      "process.argv = ['node', 'zenith', '--version']; await import('./node_modules/zenith-docs/src/cli/index.mjs');",
    );
    expect(output).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('would fail with TypeScript, which is why the entry points are JavaScript', () => {
    expect(() => run("await import('./node_modules/zenith-docs/src/options.ts');")).toThrow(
      /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/,
    );
  });
});
