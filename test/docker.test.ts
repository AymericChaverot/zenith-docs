import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JavaScript, without declarations
import { detectPackageManager, docker, dockerFiles } from '../src/cli/docker.mjs';

describe('dockerFiles', () => {
  it('builds with npm by default, and serves with unprivileged nginx', () => {
    const { Dockerfile, '.dockerignore': ignore } = dockerFiles();
    expect(Dockerfile).toContain('COPY package.json package-lock.json* ./');
    expect(Dockerfile).toContain('npm ci');
    expect(Dockerfile).toContain('FROM nginxinc/nginx-unprivileged:alpine-slim');
    expect(Dockerfile).toContain('gzip_static on;');
    expect(Dockerfile).toContain('location ~ \\.md$');
    expect(ignore).toContain('node_modules');
  });

  it('copies the pnpm workspace file, which approves build scripts', () => {
    const { Dockerfile } = dockerFiles({ packageManager: 'pnpm' });
    expect(Dockerfile).toContain('COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./');
    expect(Dockerfile).toContain('pnpm install --frozen-lockfile');
  });
});

describe('zenith docker', () => {
  const project = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'zenith-docker-'));
    for (const [name, contents] of Object.entries(files)) writeFileSync(join(root, name), contents);
    return root;
  };
  const manifest = JSON.stringify({ scripts: { build: 'zenith build' } });

  it('detects pnpm from its lockfile', () => {
    expect(detectPackageManager(project({ 'pnpm-lock.yaml': '' }))).toBe('pnpm');
    expect(detectPackageManager(project({}))).toBe('npm');
  });

  it('writes the files, and does not overwrite them without --force', () => {
    const root = project({ 'package.json': manifest });
    docker([], root);
    expect(readFileSync(join(root, 'Dockerfile'), 'utf8')).toContain('npm run build');
    expect(() => docker([], root)).toThrow(/--force/);
    expect(() => docker(['--force'], root)).not.toThrow();
  });

  it('needs a build script', () => {
    expect(() => docker([], project({ 'package.json': '{}' }))).toThrow(/build/);
  });
});
