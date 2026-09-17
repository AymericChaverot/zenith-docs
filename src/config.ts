import { z } from 'astro/zod';
// Explicit extensions: the CLI loads this module with Node, which does not guess them.
import { FONT_PRESET_NAMES } from './fonts.ts';
import { ACCENTS, BACKDROP_POSITIONS, BACKDROPS } from './options.ts';
import { THEME_NAMES } from './themes.ts';

export const DEFAULT_DOCS_DIR = 'src/content/docs';

const LinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

const LogoSchema = z.object({
  src: z.string(),
  alt: z.string().default(''),
  replacesTitle: z.boolean().default(false),
});

const TableOfContentsSchema = z.object({
  minHeadingLevel: z.number().int().min(1).max(6).default(2),
  maxHeadingLevel: z.number().int().min(1).max(6).default(3),
});

export const ZenithConfigSchema = z.object({
  /** Site name, shown in the header and used as the title suffix. */
  title: z.string().default('ZenithDocs'),
  description: z.string().optional(),
  /**
   * Logo shown in the header: a path relative to the project root (`./src/assets/logo.svg`)
   * or a public URL (`/logo.png`). SVG files are inlined, so they can use `currentColor`.
   * Defaults to the ZenithDocs logo, `false` shows none.
   */
  logo: z.union([z.literal(false), LogoSchema]).optional(),
  /** Build a static search index with Pagefind, and show the search dialog. */
  search: z.boolean().default(true),
  /** Generate `llms.txt`, `llms-full.txt` and a `.md` version of every page. */
  llms: z.boolean().default(true),
  /** Generate an Open Graph image for every page, shown when a link is shared. */
  og: z.boolean().default(true),
  /** OpenAPI specs rendered by `<APIPage>`, keyed by name, as paths from the project root. */
  openapi: z.record(z.string(), z.string()).default({}),
  /**
   * Packaged theme: an accent, a backdrop and a font preset that go together.
   * Any of those options you set yourself takes precedence over the theme.
   */
  theme: z.enum(THEME_NAMES).optional(),
  /** Accent color preset. Use `customCss` for anything else. */
  accent: z.enum(ACCENTS).default('emerald'),
  /** Decorative background at the top of pages. `true` means `dither`, `false` means `none`. */
  backdrop: z
    .union([z.boolean(), z.enum(BACKDROPS)])
    .default('dither')
    .transform((value) => (value === true ? 'dither' : value === false ? 'none' : value)),
  /** Side the backdrop is anchored to. */
  backdropPosition: z.enum(BACKDROP_POSITIONS).default('left'),
  /**
   * Font preset, self-hosted. `true` means `instrument`, `false` uses system fonts.
   * Override the families with `--font-body`, `--font-mono` and `--font-display`.
   */
  fonts: z
    .union([z.boolean(), z.enum(FONT_PRESET_NAMES)])
    .default('instrument')
    .transform((value) => (value === true ? ('instrument' as const) : value)),
  /** Favicon URL. Defaults to `public/favicon.svg` when it exists, and to the ZenithDocs icon otherwise. */
  favicon: z.string().optional(),
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
  /** Show a button at the bottom of the sidebar listing the versions the site is built with. */
  builtWith: z.boolean().default(true),
  tableOfContents: z
    .union([z.literal(false), TableOfContentsSchema])
    .default({ minHeadingLevel: 2, maxHeadingLevel: 3 }),
  /** Stylesheets loaded after ZenithDocs styles, relative to the project root. */
  customCss: z.array(z.string()).default([]),
  /** Replace built-in layout components, e.g. `{ Header: './src/components/Header.astro' }`. */
  components: z.record(z.string(), z.string()).default({}),
  /**
   * Components added at fixed places of the layout, without replacing anything,
   * e.g. `{ banner: './src/components/Banner.astro' }`. Several per place are allowed.
   */
  slots: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

/** Options as validated, before assets are resolved. */
export type ZenithParsedConfig = z.output<typeof ZenithConfigSchema>;

export type ZenithLogo = z.output<typeof LogoSchema> & {
  /** SVG markup, inlined so the logo can use `currentColor`. */
  svg?: string;
};

/** Options as components receive them, with the logo and favicon resolved. */
export type ZenithConfig = Omit<ZenithParsedConfig, 'logo' | 'favicon'> & {
  logo?: ZenithLogo;
  favicon: string;
};

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
