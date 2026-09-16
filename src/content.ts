import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { DEFAULT_DOCS_DIR } from './config';

interface LoaderOptions {
  /** Directory holding the docs content, relative to the project root. */
  base?: string;
}

/** Loads Markdown and MDX pages, ignoring files starting with `_`. */
export function docsLoader({ base = DEFAULT_DOCS_DIR }: LoaderOptions = {}): Loader {
  return glob({ base, pattern: '**/[^_]*.{md,mdx}' });
}

/** Loads `meta.json` files, which order and group pages in the sidebar. */
export function metaLoader({ base = DEFAULT_DOCS_DIR }: LoaderOptions = {}): Loader {
  return glob({
    base,
    pattern: '**/meta.json',
    generateId: ({ entry }) => entry.replaceAll('\\', '/'),
  });
}

export function docsSchema() {
  return z.object({
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    /** Use the full content width and move the table of contents out of the way. */
    full: z.boolean().default(false),
    toc: z.boolean().default(true),
    /** Draft pages are only built in development. */
    draft: z.boolean().default(false),
    sidebar: z
      .object({
        label: z.string().optional(),
        hidden: z.boolean().default(false),
      })
      .default({ hidden: false }),
    editUrl: z.union([z.string(), z.literal(false)]).optional(),
    lastUpdated: z.union([z.coerce.date(), z.literal(false)]).optional(),
  });
}

export function metaSchema() {
  return z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    pages: z.array(z.string()).optional(),
    defaultOpen: z.boolean().optional(),
    collapsible: z.boolean().optional(),
    /** Turn the folder into a sidebar tab. */
    root: z.boolean().optional(),
  });
}

export type DocsFrontmatter = z.output<ReturnType<typeof docsSchema>>;
export type MetaData = z.output<ReturnType<typeof metaSchema>>;
