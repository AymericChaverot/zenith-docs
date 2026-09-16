import { describe, expect, it } from 'vitest';
import { baseUrl, withBase } from '../src/urls';

describe('baseUrl', () => {
  it('always ends with a slash', () => {
    expect(baseUrl('/')).toBe('/');
    expect(baseUrl('/docs')).toBe('/docs/');
    expect(baseUrl('/docs/')).toBe('/docs/');
  });
});

describe('withBase', () => {
  it('prefixes root-relative URLs', () => {
    expect(withBase('/favicon.svg', '/docs/')).toBe('/docs/favicon.svg');
    expect(withBase('/favicon.svg', '/docs')).toBe('/docs/favicon.svg');
    expect(withBase('/favicon.svg', '/')).toBe('/favicon.svg');
    expect(withBase('/', '/docs')).toBe('/docs/');
    expect(withBase('/docs-old/', '/docs')).toBe('/docs/docs-old/');
  });

  it('leaves URLs that already carry the base alone', () => {
    expect(withBase('/docs/guide/', '/docs')).toBe('/docs/guide/');
    expect(withBase('/docs', '/docs/')).toBe('/docs');
  });

  it('leaves other URLs alone', () => {
    expect(withBase('https://example.com/logo.png', '/docs/')).toBe('https://example.com/logo.png');
    expect(withBase('//cdn.example.com/logo.png', '/docs/')).toBe('//cdn.example.com/logo.png');
    expect(withBase('logo.png', '/docs/')).toBe('logo.png');
    expect(withBase('#section', '/docs/')).toBe('#section');
  });
});
