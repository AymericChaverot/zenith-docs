import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveFavicon, resolveLogo } from '../src/logo';

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'zenith-assets-'));
  mkdirSync(join(dir, 'public'));
  return {
    dir,
    root: pathToFileURL(`${dir}/`),
    publicDir: pathToFileURL(`${join(dir, 'public')}/`),
  };
}

describe('resolveLogo', () => {
  it('falls back to the ZenithDocs logo', () => {
    const logo = resolveLogo(undefined, project());
    expect(logo?.alt).toBe('ZenithDocs');
    expect(logo?.svg).toMatch(/^<svg/);
  });

  it('shows no logo when disabled', () => {
    expect(resolveLogo(false, project())).toBeUndefined();
  });

  it('inlines a project SVG', () => {
    const paths = project();
    writeFileSync(join(paths.dir, 'logo.svg'), '<?xml version="1.0"?><svg id="mine"/>');
    const logo = resolveLogo({ src: './logo.svg', alt: '', replacesTitle: false }, paths);
    expect(logo?.svg).toBe('<svg id="mine"/>');
  });

  it('keeps other formats as URLs', () => {
    const logo = { src: '/logo.png', alt: 'Acme', replacesTitle: true };
    expect(resolveLogo(logo, project())).toEqual(logo);
  });
});

describe('resolveFavicon', () => {
  it('serves the ZenithDocs favicon when the project has none', () => {
    expect(resolveFavicon(undefined, project())).toEqual({
      favicon: '/favicon.svg',
      serveDefault: true,
    });
  });

  it('uses public/favicon.svg when it exists', () => {
    const paths = project();
    writeFileSync(join(paths.dir, 'public', 'favicon.svg'), '<svg/>');
    expect(resolveFavicon(undefined, paths)).toEqual({ favicon: '/favicon.svg', serveDefault: false });
  });

  it('keeps an explicit favicon', () => {
    expect(resolveFavicon('/icon.png', project())).toEqual({ favicon: '/icon.png', serveDefault: false });
  });
});
