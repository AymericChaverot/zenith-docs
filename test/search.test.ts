import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AstroIntegrationLogger } from 'astro';
import { describe, expect, it, vi } from 'vitest';
import { buildSearchIndex } from '../src/search';

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><title>${title}</title></head><body>
<nav>Sidebar</nav><article data-pagefind-body><h1>${title}</h1><p>${body}</p></article></body></html>`;
}

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AstroIntegrationLogger & {
    info: ReturnType<typeof vi.fn>;
  };
}

describe('buildSearchIndex', () => {
  it('indexes the built pages next to them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zenith-search-'));
    writeFileSync(join(dir, 'index.html'), page('Home', 'Welcome to the docs.'));
    mkdirSync(join(dir, 'guide'));
    writeFileSync(join(dir, 'guide', 'index.html'), page('Guide', 'Install the package.'));

    const log = logger();
    await buildSearchIndex(pathToFileURL(`${dir}/`), log);

    expect(existsSync(join(dir, 'pagefind', 'pagefind.js'))).toBe(true);
    expect(log.info).toHaveBeenCalledWith('Indexed 2 page(s) for search.');
  }, 30_000);
});
