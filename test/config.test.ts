import { describe, expect, it } from 'vitest';
import { ZenithConfigSchema } from '../src/config';

describe('head option', () => {
  it('takes head tags, with attributes and content', () => {
    const { head } = ZenithConfigSchema.parse({
      head: [
        { tag: 'script', attrs: { src: '/stats.js', defer: true } },
        { tag: 'style', content: 'a{}' },
      ],
    });
    expect(head).toEqual([
      { tag: 'script', attrs: { src: '/stats.js', defer: true }, content: '' },
      { tag: 'style', attrs: {}, content: 'a{}' },
    ]);
  });

  it('rejects tags that do not belong in the head', () => {
    expect(ZenithConfigSchema.safeParse({ head: [{ tag: 'div' }] }).success).toBe(false);
  });
});

describe('og option', () => {
  it('fills in the defaults when on', () => {
    expect(ZenithConfigSchema.parse({}).og).toMatchObject({
      colorScheme: 'dark',
      backdrop: 'glow',
    });
    expect(ZenithConfigSchema.parse({ og: { backdrop: 'grid' } }).og).toMatchObject({
      backdrop: 'grid',
      accentBar: true,
    });
  });

  it('stays off with false', () => {
    expect(ZenithConfigSchema.parse({ og: false }).og).toBe(false);
  });

  it('rejects colors it cannot draw', () => {
    expect(ZenithConfigSchema.safeParse({ og: { colors: { text: 'red' } } }).success).toBe(false);
  });
});
