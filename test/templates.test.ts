import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JavaScript, without declarations
import { TEMPLATES, ZENITH_VERSION } from '../src/cli/templates.mjs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('templates', () => {
  it('pin new sites to the release tag of this version', () => {
    expect(ZENITH_VERSION).toBe(`github:AymericChaverot/zenith-docs#v${version}`);
    for (const template of Object.values(TEMPLATES) as { files: Function }[]) {
      const files = template.files({ name: 'docs', title: 'Docs' });
      expect(JSON.parse(files['package.json']).dependencies['zenith-docs']).toBe(ZENITH_VERSION);
    }
  });
});
