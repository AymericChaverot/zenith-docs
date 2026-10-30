import type { Element, ElementContent, Root as HastRoot } from 'hast';
import type { Paragraph, PhrasingContent } from 'mdast';
import { directiveToMarkdown } from 'mdast-util-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import GithubSlugger from 'github-slugger';
import {
  htmlToHast,
  type HastPluginDefinition,
  type HastPluginEntry,
  type MdastPluginDefinition,
  type MdastPluginEntry,
} from 'satteri';
import { resolveCallout, type CalloutType, type ResolvedCallout } from '../callouts';
import type { MermaidOptions } from '../config';
import { parseMermaidMeta, renderMath, renderMermaid } from './diagrams';
import { convertCommand, PACKAGE_MANAGERS } from './package-managers';
import { DEFAULT_TRANSLATIONS, type Translations } from '../translations';
import { withBase } from '../urls';

/** Interface strings for the file being processed. */
export type TranslationsForFile = (fileURL: URL | undefined) => Translations;

const defaultTranslations: TranslationsForFile = () => DEFAULT_TRANSLATIONS as Translations;

const calloutTitle = (t: Translations, callout: ResolvedCallout) =>
  (t as Record<string, string>)[`callout.${callout.name}`] ?? callout.title;

export function zenithMdastPlugins(
  t: TranslationsForFile = defaultTranslations,
): MdastPluginEntry[] {
  return [({ fileURL }) => calloutsPlugin(t(fileURL)), packageManagersPlugin()];
}

export function zenithHastPlugins(
  t: TranslationsForFile = defaultTranslations,
  base = '/',
  mermaid: MermaidOptions = { spacing: 'normal', colors: {}, fallback: 'code' },
): HastPluginEntry[] {
  // A factory so each file gets its own slugger and its own language.
  return [
    ({ fileURL }) => [
      headingsPlugin(t(fileURL)),
      diagramsPlugin(fileURL, mermaid),
      codeBlocksPlugin(t(fileURL)),
    ],
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

/**
 * ```npm code blocks, shown as tabs with the same commands for each package manager.
 * The markup is the one of `<Tabs groupId="package-manager" persist>`.
 */
function packageManagersPlugin(): MdastPluginDefinition {
  return {
    name: 'zenith-package-managers',
    code(node) {
      if (node.lang !== 'npm') return;
      const lines = node.value.split('\n');
      return element(
        'zd-tabs',
        { class: 'zd-tabs', 'data-group': 'package-manager', 'data-persist': '' },
        PACKAGE_MANAGERS.map((pm) =>
          element(
            'div',
            { class: 'zd-tab-panel', role: 'tabpanel', 'data-value': pm, tabindex: '0' },
            [
              element('p', { class: 'zd-tab-label', 'data-pagefind-ignore': '' }, [
                { type: 'text', value: pm },
              ]),
              {
                type: 'code',
                lang: 'sh',
                meta: node.meta,
                value: lines.map((line) => convertCommand(line, pm)).join('\n'),
              },
            ],
          ),
        ),
      );
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

/**
 * ```mermaid code blocks drawn as SVG, and math rendered as MathML, at build time.
 * The markup is parsed into elements, so it goes through MDX like any other.
 */
function diagramsPlugin(fileURL: URL | undefined, mermaid: MermaidOptions): HastPluginDefinition {
  return {
    name: 'zenith-diagrams',
    element: {
      filter: ['pre', 'code'],
      visit(node, ctx) {
        if (node.tagName === 'code') {
          if (!hasClass(node as Element, 'math-inline')) return;
          return parseHtml(renderMath(ctx.textContent(node), false));
        }

        const code = node.children.find(
          (child): child is Element => child.type === 'element' && child.tagName === 'code',
        );
        if (!code) return;
        if (hasClass(code, 'math-display'))
          return parseHtml(renderMath(ctx.textContent(node), true));

        // Shiki marks the language on `<pre>`, plain Markdown on `<code>`.
        const language = node.properties?.dataLanguage ?? node.properties?.['data-language'];
        if (language !== 'mermaid' && !hasClass(code, 'language-mermaid')) return;

        // Plain Markdown keeps the fence meta on the node, Shiki output on `<pre>`.
        const meta = parseMermaidMeta(
          String(
            (code.data as { meta?: string } | undefined)?.meta ??
              node.properties?.dataMeta ??
              node.properties?.['data-meta'] ??
              '',
          ),
        );
        try {
          const svg = renderMermaid(ctx.textContent(node), {
            ...mermaid,
            spacing: meta.spacing ?? mermaid.spacing,
          });
          const caption = meta.title
            ? `<figcaption class="zd-mermaid-title">${escapeHtml(meta.title)}</figcaption>`
            : '';
          return parseHtml(`<figure class="zd-mermaid">${svg}${caption}</figure>`);
        } catch (error) {
          const file = fileURL ? ` in ${fileURL.pathname}` : '';
          const message = `Mermaid diagram${file}: ${(error as Error).message}`;
          if (mermaid.fallback === 'error') throw new Error(`[zenith-docs] ${message}`);
          // Diagram types the renderer does not draw stay readable as code.
          console.warn(`[zenith-docs] ${message}, shown as code`);
        }
      },
    },
  };
}

/**
 * The single element of an HTML fragment. `xmlns` is dropped: HTML does not need it on
 * `<svg>` and `<math>`, and the parser would keep it as a namespaced `:xmlns`.
 */
function parseHtml(html: string): Element {
  const root = htmlToHast(html.replace(/\sxmlns="[^"]*"/g, ''), { fragment: true }) as HastRoot;
  return root.children.find((child): child is Element => child.type === 'element')!;
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
        const caption =
          typeof title === 'string' ? title : typeof dataTitle === 'string' ? dataTitle : '';
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hasClass(node: Element, name: string): boolean {
  const value = node.properties?.class ?? node.properties?.className;
  const list = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/\s+/);
  return list.includes(name);
}

function element(
  tagName: string,
  properties: Record<string, string>,
  children: unknown[],
): Paragraph {
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
