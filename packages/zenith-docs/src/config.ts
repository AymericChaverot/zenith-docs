import { z } from 'astro/zod';
import { FONT_PRESET_NAMES } from './fonts';

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
  /**
   * Logo shown in the header: a path relative to the project root (`./src/assets/logo.svg`)
   * or a public URL (`/logo.png`). SVG files are inlined, so they can use `currentColor`.
   */
  logo: z
    .object({
      src: z.string(),
      alt: z.string().default(''),
      replacesTitle: z.boolean().default(false),
      /** SVG markup, filled in by ZenithDocs. */
      svg: z.string().optional(),
    })
    .optional(),
  /** Build a static search index with Pagefind, and show the search dialog. */
  search: z.boolean().default(true),
  /** Generate `llms.txt`, `llms-full.txt` and a `.md` version of every page. */
  llms: z.boolean().default(true),
  /** Generate an Open Graph image for every page, shown when a link is shared. */
  og: z.boolean().default(true),
  /** OpenAPI specs rendered by `<APIPage>`, keyed by name, as paths from the project root. */
  openapi: z.record(z.string(), z.string()).default({}),
  /** Accent color preset. Use `customCss` for anything else. */
  accent: z.enum(['emerald', 'teal', 'amber', 'rose', 'violet', 'neutral']).default('emerald'),
  /** Decorative background at the top of pages. `true` means `aurora`, `false` means `none`. */
  backdrop: z
    .union([
      z.boolean(),
      z.enum([
        'none',
        'glow',
        'grid',
        'dots',
        'dither',
        'aurora',
        'rays',
        'grain',
        'horizon',
        'horizon-glow',
      ]),
    ])
    .default('dither')
    .transform((value) => (value === true ? 'dither' : value === false ? 'none' : value)),
  /** Side the backdrop is anchored to. */
  backdropPosition: z.enum(['left', 'center', 'right']).default('left'),
  /**
   * Font preset, self-hosted. `true` means `instrument`, `false` uses system fonts.
   * Override the families with `--font-body`, `--font-mono` and `--font-display`.
   */
  fonts: z
    .union([z.boolean(), z.enum(FONT_PRESET_NAMES)])
    .default('instrument')
    .transform((value) => (value === true ? ('instrument' as const) : value)),
  favicon: z.string().default('/favicon.svg'),
  lang: z.string().default('en'),
  /**
   * Languages of the site, keyed by content directory and URL prefix.
   * The `root` key is the default language, served without a prefix.
   */
  locales: z
    .record(
      z.string(),
      z.object({
        label: z.string(),
        /** BCP-47 tag, defaults to the key. */
        lang: z.string().optional(),
        dir: z.enum(['ltr', 'rtl']).default('ltr'),
      }),
    )
    .optional(),
  /** Interface strings, keyed by locale, overriding the built-in ones. */
  translations: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /**
   * Documentation versions, keyed by content directory and URL prefix.
   * The `root` key is the current version, served without a prefix.
   */
  versions: z
    .record(z.string(), z.object({ label: z.string(), badge: z.string().optional() }))
    .optional(),
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

export type ZenithConfig = z.output<typeof ZenithConfigSchema>;

export type ZenithUserConfig = z.input<typeof ZenithConfigSchema> & {
  /** Deployed URL, used for canonical links, the sitemap and social images. CLI only. */
  site?: string;
  /** Path the site is served from, such as `/docs`. CLI only. */
  base?: string;
};

/** Identity function that types a `zenith.config.ts` file. */
export function defineConfig(config: ZenithUserConfig): ZenithUserConfig {
  return config;
}
