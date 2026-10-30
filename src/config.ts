import { z } from 'astro/zod';
// Explicit extensions: the CLI loads this module with Node, which does not guess them.
import { isSupportedColor } from './colors.ts';
import { FONT_PRESET_NAMES } from './fonts.ts';
import { ACCENTS, BACKDROP_POSITIONS, BACKDROPS } from './options.ts';
import { THEME_NAMES } from './themes.ts';

export const DEFAULT_DOCS_DIR = 'src/content/docs';

const LinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

const ColorSchema = z.string().refine(isSupportedColor, {
  message: 'Expected a color as `#rrggbb`, `#rgb` or `oklch(L C H)`',
});

const HeadTagSchema = z.object({
  tag: z.enum(['link', 'meta', 'script', 'style', 'noscript', 'base']),
  attrs: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
  content: z.string().default(''),
});

export const OG_BACKDROPS = ['glow', 'grid', 'dots', 'none'] as const;

export const OG_LAYOUTS = ['default', 'centered', 'split'] as const;

export const OG_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

const OgSchema = z.object({
  /** Arrangement of the card: text on the left, on the center line, or next to a large logo. */
  layout: z.enum(OG_LAYOUTS).default('default'),
  /** Logo of the card, the one of the site. `false` leaves it out. */
  logo: z
    .union([
      z.literal(false),
      z.object({
        /**
         * Image used instead of the logo of the site: an SVG, PNG or JPEG file, as a path
         * from the project root (`./src/assets/card-logo.svg`) or from `public/` (`/logo.png`).
         */
        src: z.string().optional(),
        /** Height in pixels, in the corner of the card. */
        size: z.number().positive().default(44),
        /** Corner holding the logo and the site name. */
        position: z.enum(OG_POSITIONS).default('top-left'),
      }),
    ])
    .default({ size: 44, position: 'top-left' }),
  /** Site name next to the logo: `true` for the `title` option, or another text. */
  siteName: z.union([z.boolean(), z.string()]).default(true),
  /** Show the description of the page. */
  description: z.boolean().default(true),
  /** Show the folders the page belongs to. */
  breadcrumb: z.boolean().default(true),
  /** Show the language and version, on sites that have several. */
  badges: z.boolean().default(true),
  /**
   * Module drawing the card instead of the built-in template, as a path from the project
   * root. Its default export receives the page and the options, and returns satori nodes.
   */
  template: z.string().optional(),
  /** Palette the card is drawn with. */
  colorScheme: z.enum(['dark', 'light']).default('dark'),
  /** Colors taking precedence over the palette and the accent of the site. */
  colors: z
    .object({
      background: ColorSchema.optional(),
      text: ColorSchema.optional(),
      muted: ColorSchema.optional(),
      accent: ColorSchema.optional(),
      border: ColorSchema.optional(),
    })
    .default({}),
  /** Decoration drawn with the accent behind the text. */
  backdrop: z.enum(OG_BACKDROPS).default('glow'),
  /** Accent line along the top edge. */
  accentBar: z.boolean().default(true),
  /**
   * Image covering the card, under the backdrop and the text: an SVG, PNG or JPEG file,
   * as a path from the project root or from `public/`.
   */
  background: z.string().optional(),
  /**
   * Font of the card instead of Geist, from TTF, OTF or WOFF files given as paths from
   * the project root or from `public/`. Geist still draws the characters they lack.
   */
  font: z
    .object({
      /** Family name, only used to tell the fonts apart. */
      name: z.string().default('Custom'),
      files: z
        .array(
          z.object({
            path: z.string(),
            weight: z.number().int().min(100).max(900).multipleOf(100).default(400),
            style: z.enum(['normal', 'italic']).default('normal'),
          }),
        )
        .min(1),
    })
    .optional(),
});

export const MERMAID_SPACINGS = ['compact', 'normal', 'wide'] as const;

const MermaidSchema = z.object({
  /** Room between the nodes of a diagram. A code block can set its own with a keyword. */
  spacing: z.enum(MERMAID_SPACINGS).default('normal'),
  /**
   * Colors of the diagrams, as any CSS color or variable. They default to colors derived
   * from the text and background of the site, and `accent` to the accent of the site.
   */
  colors: z
    .object({
      accent: z.string().optional(),
      line: z.string().optional(),
      muted: z.string().optional(),
      surface: z.string().optional(),
      border: z.string().optional(),
    })
    .default({}),
  /**
   * What a diagram of an unsupported type becomes: `code` shows its source with a warning in
   * the build output, `error` fails the build.
   */
  fallback: z.enum(['code', 'error']).default('code'),
});

/** A text, or one text per locale key, with the `root` one as the fallback. */
const LocalizedSchema = z.union([z.string(), z.record(z.string(), z.string())]);

export const ANNOUNCEMENT_VARIANTS = [
  'default',
  'note',
  'tip',
  'success',
  'warning',
  'danger',
] as const;

const AnnouncementSchema = z.object({
  /** Plain text of the bar. */
  text: LocalizedSchema,
  /** Link shown after the text. */
  link: z.object({ label: LocalizedSchema, href: z.string() }).optional(),
  /** Color of the bar: the accent, or the one of a callout. */
  variant: z.enum(ANNOUNCEMENT_VARIANTS).default('default'),
  /** Add a button to close the bar. It stays closed until the announcement changes. */
  dismissible: z.boolean().default(true),
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
  /**
   * Show buttons under the page title to copy the page as Markdown, view it, or open it
   * in ChatGPT or Claude, which needs `site`. Requires `llms`.
   */
  pageActions: z.boolean().default(true),
  /**
   * Render TeX between `$` and `$$` as math, with MathML. Off by default, since it changes
   * what dollar signs mean in existing content.
   */
  math: z.boolean().default(false),
  /** A bar above the header of every page, for news such as a release. A string is its text. */
  announcement: z
    .union([z.string(), AnnouncementSchema])
    .optional()
    .transform((announcement) =>
      typeof announcement === 'string'
        ? AnnouncementSchema.parse({ text: announcement })
        : announcement,
    ),
  /** Look of the Mermaid diagrams, which are drawn at build time. */
  mermaid: MermaidSchema.default({ spacing: 'normal', colors: {}, fallback: 'code' }),
  /**
   * Generate an Open Graph image for every page, shown when a link is shared. An object
   * turns it on and changes how the card looks.
   */
  og: z
    .union([z.boolean(), OgSchema])
    .default(true)
    .transform((og) => (og === false ? false : OgSchema.parse(og === true ? {} : og))),
  /** OpenAPI specs rendered by `<APIPage>`, keyed by name, as paths from the project root. */
  openapi: z.record(z.string(), z.string()).default({}),
  /**
   * Packaged theme: an accent, a backdrop and a font preset that go together.
   * Any of those options you set yourself takes precedence over the theme.
   */
  theme: z.enum(THEME_NAMES).optional(),
  /**
   * Accent color: a preset, a color for both color schemes, or `{ light, dark }`.
   * Colors are written as `#rrggbb` or `oklch(L C H)`.
   */
  accent: z
    .union([z.enum(ACCENTS), ColorSchema, z.object({ light: ColorSchema, dark: ColorSchema })])
    .default('emerald'),
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
  /**
   * Check internal links once the site is built: each must lead to a page or file of the
   * build, and to an id that page has. `warn` lists broken links, `error` also fails the build.
   */
  linkValidation: z.union([z.enum(['warn', 'error']), z.literal(false)]).default('warn'),
  /** Show the last commit date of each page. Requires the site to be built from a git checkout. */
  lastUpdated: z.boolean().default(false),
  /** Show a button at the bottom of the sidebar listing the versions the site is built with. */
  builtWith: z.boolean().default(true),
  tableOfContents: z
    .union([z.literal(false), TableOfContentsSchema])
    .default({ minHeadingLevel: 2, maxHeadingLevel: 3 }),
  /**
   * Tags added to the `<head>` of every page, after the built-in ones, such as an analytics
   * script: `{ tag: 'script', attrs: { src: '/stats.js', defer: true } }`.
   */
  head: z.array(HeadTagSchema).default([]),
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

/** Options of the Open Graph images, with their defaults. */
export type OgOptions = z.output<typeof OgSchema>;

/** The announcement bar, as configured. */
export type AnnouncementOptions = z.output<typeof AnnouncementSchema>;

/** Options of the Mermaid diagrams, with their defaults. */
export type MermaidOptions = z.output<typeof MermaidSchema>;

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
