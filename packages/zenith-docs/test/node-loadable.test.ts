import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * The CLI runs under plain Node, without a bundler, so the modules it loads must resolve
 * there: relative imports need their extension. Vitest resolves them regardless, which is
 * why this goes through a real Node process.
 */
const load = (path: string) =>
  execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(path)}); console.log('ok');`],
    { encoding: 'utf8' },
  ).trim();

describe('modules loaded by the CLI', () => {
  it.each(['../src/config.ts', '../src/cli/project.ts'])('%s loads under plain Node', (path) => {
    const url = new URL(path, import.meta.url).href;
    expect(load(url)).toBe('ok');
  });

  it('defineConfig is usable from a config file', () => {
    const url = new URL('../src/config.ts', import.meta.url).href;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const { defineConfig } = await import(${JSON.stringify(url)}); console.log(defineConfig({ title: 'x', theme: 'paper' }).theme);`,
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(output).toBe('paper');
  });
});
