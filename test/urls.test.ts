import { describe, expect, it } from 'vitest';
import { withBase } from '../src/urls';

describe('withBase', () => {
  it('prefixes root-relative URLs', () => {
    expect(withBase('/favicon.svg', '/docs/')).toBe('/docs/favicon.svg');
    expect(withBase('/favicon.svg', '/docs')).toBe('/docs/favicon.svg');
    expect(withBase('/favicon.svg', '/')).toBe('/favicon.svg');
  });

  it('leaves other URLs alone', () => {
    expect(withBase('https://example.com/logo.png', '/docs/')).toBe('https://example.com/logo.png');
    expect(withBase('//cdn.example.com/logo.png', '/docs/')).toBe('//cdn.example.com/logo.png');
    expect(withBase('logo.png', '/docs/')).toBe('logo.png');
  });
});
