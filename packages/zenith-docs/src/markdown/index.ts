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
import { CALLOUT_TITLES, resolveCalloutType, type CalloutType } from '../callouts';

export function zenithMdastPlugins(): MdastPluginEntry[] {
  return [calloutsPlugin()];
}

export function zenithHastPlugins(): HastPluginEntry[] {
  // A factory so each file gets its own slugger.
  return [() => [headingsPlugin(), codeBlocksPlugin()]];
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
function calloutsPlugin(): MdastPluginDefinition {
  return {
    name: 'zenith-callouts',
    containerDirective(node) {
      const type = resolveCalloutType(node.name);
      if (!type) return;

      const children = [...node.children];
      const first = children[0];
      let title: PhrasingContent[] | undefined;
      if (first?.type === 'paragraph' && first.data?.directiveLabel && first.children.length > 0) {
        title = [...first.children];
        children.shift();
      }
      return callout(type, title, children);
    },
    blockquote(node) {
      const first = node.children[0];
      const text = first?.type === 'paragraph' ? first.children[0] : undefined;
      if (!first || first.type !== 'paragraph' || text?.type !== 'text') return;

      const match = /^\[!(\w+)\][ \t]*(?:\r?\n|$)/.exec(text.value);
      const type = match && resolveCalloutType(match[1]!);
      if (!match || !type) return;

      const remainingText = text.value.slice(match[0].length);
      const remaining: PhrasingContent[] = [
        ...(remainingText ? [{ type: 'text' as const, value: remainingText }] : []),
        ...first.children.slice(1),
      ];
      const children = [
        ...(remaining.length > 0 ? [{ ...first, children: remaining }] : []),
        ...node.children.slice(1),
      ];
      return callout(type, undefined, children);
    },
  };
}

function callout(type: CalloutType, title: PhrasingContent[] | undefined, children: unknown[]) {
  return element('aside', { class: 'zd-callout', 'data-callout': type }, [
    element('p', { class: 'zd-callout-title' }, title ?? [{ type: 'text', value: CALLOUT_TITLES[type] }]),
    element('div', { class: 'zd-callout-body' }, children),
  ]);
}

/** Custom `## Title [#id]` ids and anchor links next to headings. */
function headingsPlugin(): HastPluginDefinition {
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
                'aria-label': `Link to this section`,
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
function codeBlocksPlugin(): HastPluginDefinition {
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
          properties: { type: 'button', class: 'zd-copy', 'aria-label': 'Copy code', 'data-copy': '' },
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
    data: { hName: tagName, hProperties: properties },
    children: children as Paragraph['children'],
  };
}

function serializeDirective(node: Parameters<typeof toMarkdown>[0]): string {
  const md = toMarkdown(node, { extensions: [directiveToMarkdown()] });
  return md.endsWith('\n') ? md.slice(0, -1) : md;
}

export type { HastRoot };
