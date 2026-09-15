import { z } from 'astro/zod';

export const DEFAULT_DOCS_DIR = 'src/content/docs';

const LinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

const TableOfContentsSchema = z.object({
  minHeadingLevel: z.number().int().min(1).max(6).default(2),
  maxHeadingLevel: z.number().int().min(1).max(6).default(3),
});

export const ZenithConfigSchema = z.object({
  /** Site name, shown in the header and used as the title suffix. */
  title: z.string(),
  description: z.string().optional(),
  /** Public URL of a logo image, e.g. `/logo.svg`. */
  logo: z
    .object({
      src: z.string(),
      alt: z.string().default(''),
      replacesTitle: z.boolean().default(false),
    })
    .optional(),
  favicon: z.string().default('/favicon.svg'),
  lang: z.string().default('en'),
  /** Directory holding the docs content, relative to the project root. */
  docsDir: z.string().default(DEFAULT_DOCS_DIR),
  /** Repository URL, shown as an icon link in the header. */
  github: z.string().optional(),
  /** Extra links shown in the header. */
  links: z.array(LinkSchema).default([]),
  /** Base URL used to build "Edit this page" links, e.g. `https://github.com/org/repo/edit/main/`. */
  editLink: z.object({ baseUrl: z.string() }).optional(),
  /** Show the last commit date of each page. Requires the site to be built from a git checkout. */
  lastUpdated: z.boolean().default(false),
  tableOfContents: z
    .union([z.literal(false), TableOfContentsSchema])
    .default({ minHeadingLevel: 2, maxHeadingLevel: 3 }),
  /** Stylesheets loaded after ZenithDocs styles, relative to the project root. */
  customCss: z.array(z.string()).default([]),
  /** Replace built-in layout components, e.g. `{ Header: './src/components/Header.astro' }`. */
  components: z.record(z.string(), z.string()).default({}),
});

export type ZenithUserConfig = z.input<typeof ZenithConfigSchema>;
export type ZenithConfig = z.output<typeof ZenithConfigSchema>;
