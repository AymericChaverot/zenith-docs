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

describe('announcement option', () => {
  it('is off unless set', () => {
    expect(ZenithConfigSchema.parse({}).announcement).toBeUndefined();
  });

  it('takes a string as its text', () => {
    expect(ZenithConfigSchema.parse({ announcement: 'Version 2 is out' }).announcement).toEqual({
      text: 'Version 2 is out',
      variant: 'default',
      dismissible: true,
    });
  });

  it('takes a link, a variant and a text per locale', () => {
    const { announcement } = ZenithConfigSchema.parse({
      announcement: {
        text: { root: 'Version 2 is out', fr: 'La version 2 est sortie' },
        link: { label: 'Read more', href: '/changelog/' },
        variant: 'tip',
        dismissible: false,
      },
    });
    expect(announcement).toMatchObject({ variant: 'tip', dismissible: false });
  });

  it('rejects unknown variants', () => {
    expect(
      ZenithConfigSchema.safeParse({ announcement: { text: 'Hi', variant: 'loud' } }).success,
    ).toBe(false);
  });
});

describe('mermaid option', () => {
  it('has defaults', () => {
    expect(ZenithConfigSchema.parse({}).mermaid).toEqual({
      spacing: 'normal',
      colors: {},
      fallback: 'code',
    });
  });

  it('rejects unknown spacings and fallbacks', () => {
    expect(ZenithConfigSchema.safeParse({ mermaid: { spacing: 'huge' } }).success).toBe(false);
    expect(ZenithConfigSchema.safeParse({ mermaid: { fallback: 'hide' } }).success).toBe(false);
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
