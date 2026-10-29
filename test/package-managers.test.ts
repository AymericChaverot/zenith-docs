import { describe, expect, it } from 'vitest';
import { convertCommand, type PackageManager } from '../src/markdown/package-managers';

const all = (line: string) =>
  Object.fromEntries(
    (['npm', 'pnpm', 'yarn', 'bun'] as PackageManager[]).map((pm) => [
      pm,
      convertCommand(line, pm),
    ]),
  );

describe('convertCommand', () => {
  it('installs dependencies', () => {
    expect(all('npm install')).toEqual({
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
      bun: 'bun install',
    });
  });

  it('adds packages', () => {
    expect(all('npm i astro zenith-docs')).toEqual({
      npm: 'npm i astro zenith-docs',
      pnpm: 'pnpm add astro zenith-docs',
      yarn: 'yarn add astro zenith-docs',
      bun: 'bun add astro zenith-docs',
    });
  });

  it('adds development dependencies', () => {
    expect(all('npm install --save-dev vitest')).toMatchObject({
      pnpm: 'pnpm add -D vitest',
      yarn: 'yarn add -D vitest',
      bun: 'bun add -d vitest',
    });
  });

  it('adds global packages', () => {
    expect(all('npm install -g pagefind')).toMatchObject({
      pnpm: 'pnpm add -g pagefind',
      yarn: 'yarn global add pagefind',
      bun: 'bun add -g pagefind',
    });
  });

  it('removes packages', () => {
    expect(all('npm uninstall astro')).toMatchObject({
      pnpm: 'pnpm remove astro',
      yarn: 'yarn remove astro',
      bun: 'bun remove astro',
    });
  });

  it('runs scripts', () => {
    expect(all('npm run build')).toMatchObject({
      pnpm: 'pnpm run build',
      yarn: 'yarn build',
      bun: 'bun run build',
    });
  });

  it('runs packages without installing them', () => {
    expect(all('npx github:AymericChaverot/zenith-docs create')).toMatchObject({
      pnpm: 'pnpm dlx github:AymericChaverot/zenith-docs create',
      yarn: 'yarn dlx github:AymericChaverot/zenith-docs create',
      bun: 'bunx github:AymericChaverot/zenith-docs create',
    });
  });

  it('runs installed binaries', () => {
    expect(all('npm exec -- zenith dev')).toMatchObject({
      pnpm: 'pnpm exec zenith dev',
      bun: 'bunx zenith dev',
    });
  });

  it('passes other commands through', () => {
    expect(all('npm create astro@latest')).toMatchObject({
      pnpm: 'pnpm create astro@latest',
      yarn: 'yarn create astro@latest',
      bun: 'bun create astro@latest',
    });
  });

  it('leaves other lines alone', () => {
    expect(convertCommand('cd my-docs', 'pnpm')).toBe('cd my-docs');
    expect(convertCommand('# npm install', 'pnpm')).toBe('# npm install');
  });
});
