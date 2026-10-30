import { AstroError } from 'astro/errors';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JavaScript, without declarations
import { formatError } from '../src/cli/errors.mjs';
import zenith from '../src/index';

describe('formatError', () => {
  it('prints the invalid options of a config', () => {
    let error: unknown;
    try {
      zenith({ accent: 'not a color' } as never);
    } catch (e) {
      error = e;
    }
    expect(formatError(error)).toBe(
      'Invalid ZenithDocs configuration\n' +
        '- accent: Expected a color as `#rrggbb`, `#rgb` or `oklch(L C H)`',
    );
  });

  it('prints the hint of every cause', () => {
    const inner = new AstroError('Missing `root` locale', 'Add a `root` entry.');
    const outer = new Error('Unable to load the config', { cause: inner });
    expect(formatError(outer)).toBe(
      'Unable to load the config\nCaused by: Missing `root` locale\nAdd a `root` entry.',
    );
  });

  it('prints values that are not errors', () => {
    expect(formatError('stopped')).toBe('stopped');
  });
});
