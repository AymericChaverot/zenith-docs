import type { Element, ElementContent, Root as HastRoot } from 'hast';
import type { Paragraph, PhrasingContent } from 'mdast';
import { directiveToMarkdown } from 'mdast-util-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import GithubSlugger from 'github-slugger';
import type {
  HastPluginDefinition,
  HastPluginEntry,
  MdastPluginDefinition,
  MdastPluginEntry,
} from 'satteri';
import { resolveCallout, type CalloutType, type ResolvedCallout } from '../callouts';
import { DEFAULT_TRANSLATIONS, type Translations } from '../translations';
import { withBase } from '../urls';

/** Interface strings for the file being processed. */
export type TranslationsForFile = (fileURL: URL | undefined) => Translations;

const defaultTranslations: TranslationsForFile = () => DEFAULT_TRANSLATIONS as Translations;

const calloutTitle = (t: Translations, callout: ResolvedCallout) =>
  (t as Record<string, string>)[`callout.${callout.name}`] ?? callout.title;

export function zenithMdastPlugins(t: TranslationsForFile = defaultTranslations): MdastPluginEntry[] {
  return [({ fileURL }) => calloutsPlugin(t(fileURL))];
}

export function zenithHastPlugins(
  t: TranslationsForFile = defaultTranslations,
  base = '/',
): HastPluginEntry[] {
  // A factory so each file gets its own slugger and its own language.
  return [
    ({ fileURL }) => [headingsPlugin(t(fileURL)), codeBlocksPlugin(t(fileURL))],
    ...(base === '/' ? [] : [linksPlugin(base)]),
  ];
}

/**
 * Links written from the root of the site, like `[Install](/installation/)`, get the base
 * the site is served from, so content does not have to repeat it.
 */
function linksPlugin(base: string): HastPluginDefinition {
  return {
    name: 'zenith-links',
    element: {
      filter: ['a'],
      visit(node) {
        const href = node.properties.href;
        if (typeof href !== 'string') return;
        const prefixed = withBase(href, base);
        if (prefixed === href) return;
        return { ...node, properties: { ...node.properties, href: prefixed } };
      },
    },
  };
}

/** Turn unclaimed directives back into text so content like `10:30` isn't lost. */
export function directivesRestorationPlugin(): MdastPluginDefinition {
  return {
    name: 'zenith-directives-restoration',
    textDirective(node) {
      if (node.data !== undefined) return;
      return { type: 'text', value: serializeDirective(node) };
    },
    leafDirective(node) {
      if (node.data !== undefined) return;
      return { type: 'paragraph', children: [{ type: 'text', value: serializeDirective(node) }] };
    },
    containerDirective(node) {
      if (node.data !== undefined) return;
      return element('div', {}, [...node.children]);
    },
  };
}

/** `:::warning[Title]` directives and GitHub `> [!NOTE]` alerts. */
function calloutsPlugin(t: Translations): MdastPluginDefinition {
  return {
    name: 'zenith-callouts',
    containerDirective(node) {
      const resolved = resolveCallout(node.name);
      if (!resolved) return;

      const children = [...node.children];
      const first = children[0];
      let title: PhrasingContent[] | undefined;
      if (first?.type === 'paragraph' && first.data?.directiveLabel && first.children.length > 0) {
        title = [...first.children];
        children.shift();
      }
      return callout(resolved.type, title ?? calloutTitle(t, resolved), children);
    },
    blockquote(node) {
      const first = node.children[0];
      const text = first?.type === 'paragraph' ? first.children[0] : undefined;
      if (!first || first.type !== 'paragraph' || text?.type !== 'text') return;

      const match = /^\[!(\w+)\][ \t]*(?:\r?\n|$)/.exec(text.value);
      const resolved = match && resolveCallout(match[1]!);
      if (!match || !resolved) return;

      const remainingText = text.value.slice(match[0].length);
      const remaining: PhrasingContent[] = [
        ...(remainingText ? [{ type: 'text' as const, value: remainingText }] : []),
        ...first.children.slice(1),
      ];
      const children = [
        ...(remaining.length > 0 ? [{ ...first, children: remaining }] : []),
        ...node.children.slice(1),
      ];
      return callout(resolved.type, calloutTitle(t, resolved), children);
    },
  };
}

function callout(type: CalloutType, title: PhrasingContent[] | string, children: unknown[]) {
  const titleChildren = typeof title === 'string' ? [{ type: 'text', value: title }] : title;
  return element('aside', { class: 'zd-callout', 'data-callout': type }, [
    element('p', { class: 'zd-callout-title' }, titleChildren),
    element('div', { class: 'zd-callout-body' }, children),
  ]);
}

/** Custom `## Title [#id]` ids and anchor links next to headings. */
function headingsPlugin(t: Translations): HastPluginDefinition {
  const slugger = new GithubSlugger();
  return {
    name: 'zenith-headings',
    element: {
      filter: ['h2', 'h3', 'h4', 'h5', 'h6'],
      visit(node, ctx) {
        const parent = ctx.parent(node);
        if (parent?.type === 'element' && hasClass(parent, 'zd-heading')) return;
        // Visually hidden headings, like the GFM footnotes label, get no anchor.
        if (hasClass(node as Element, 'sr-only')) return;

        let heading: Element = { ...node, properties: { ...node.properties } };
        const last = heading.children.at(-1);
        const custom = last?.type === 'text' ? /\s*\[#([\w-]+)\]\s*$/.exec(last.value) : null;
        if (custom && last?.type === 'text') {
          heading.children = [
            ...heading.children.slice(0, -1),
            { type: 'text', value: last.value.slice(0, custom.index) },
          ];
          heading.properties.id = custom[1];
        }
        if (typeof heading.properties.id !== 'string') {
          heading.properties.id = slugger.slug(ctx.textContent(node));
        }
        const id = heading.properties.id as string;

        return {
          type: 'element',
          tagName: 'div',
          properties: { class: `zd-heading zd-heading-${node.tagName}` },
          children: [
            heading,
            {
              type: 'element',
              tagName: 'a',
              properties: {
                class: 'zd-anchor',
                href: `#${id}`,
                'aria-label': t['page.anchor'],
                'data-pagefind-ignore': '',
              },
              children: [],
            },
          ],
        } satisfies Element;
      },
    },
  };
}

/** Wrap highlighted `<pre>` blocks with a title bar and a copy button. */
function codeBlocksPlugin(t: Translations): HastPluginDefinition {
  return {
    name: 'zenith-code-blocks',
    element: {
      filter: ['pre'],
      visit(node, ctx) {
        const parent = ctx.parent(node);
        if (parent?.type === 'element' && hasClass(parent, 'zd-code')) return;

        const { 'data-title': title, dataTitle, ...properties } = node.properties ?? {};
        const caption = typeof title === 'string' ? title : typeof dataTitle === 'string' ? dataTitle : '';
        const children: ElementContent[] = [];
        if (caption) {
          children.push({
            type: 'element',
            tagName: 'figcaption',
            properties: { class: 'zd-code-title' },
            children: [{ type: 'text', value: caption }],
          });
        }
        children.push({ ...node, properties } as Element, {
          type: 'element',
          tagName: 'button',
          properties: {
            type: 'button',
            class: 'zd-copy',
            'aria-label': t['code.copy'],
            'data-copy': '',
          },
          children: [],
        });

        return {
          type: 'element',
          tagName: 'figure',
          properties: { class: caption ? 'zd-code zd-code-titled' : 'zd-code' },
          children,
        } satisfies Element;
      },
    },
  };
}

function hasClass(node: Element, name: string): boolean {
  const value = node.properties?.class ?? node.properties?.className;
  const list = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/\s+/);
  return list.includes(name);
}

function element(tagName: string, properties: Record<string, string>, children: unknown[]): Paragraph {
  return {
    type: 'paragraph',
    // `hName` and `hProperties` are read by the mdast to hast conversion.
    data: { hName: tagName, hProperties: properties } as Paragraph['data'],
    children: children as Paragraph['children'],
  };
}

function serializeDirective(node: Parameters<typeof toMarkdown>[0]): string {
  const md = toMarkdown(node, { extensions: [directiveToMarkdown()] });
  return md.endsWith('\n') ? md.slice(0, -1) : md;
}

export type { HastRoot };
