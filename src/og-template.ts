/**
 * Drawing of Open Graph images, kept apart from the renderer so custom templates can
 * import it as `zenith-docs/og` and reuse the built-in card or its pieces.
 */
import { toRgba } from './colors';
import type { OgOptions } from './config';

/** Colors of a card, in sRGB: neither satori nor resvg parses `oklch`. */
export interface OgColors {
  background: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

/** An image placed on the card, as a data URI. */
export interface OgImage {
  src: string;
  width: number;
  height: number;
}

/** What a template draws, with the options of the site already applied. */
export interface OgTemplateProps {
  title: string;
  /** Left out when the page has none, or `description` is off. */
  description?: string;
  /** Breadcrumb trail, left out when `breadcrumb` is off. */
  section?: string;
  /** Language and version, empty when `badges` is off. */
  badges: string[];
  /** Left out on the home page, whose title is already the site name, or when `siteName` is off. */
  siteName?: string;
  /** URL path of the page, such as `/guides/setup/`. */
  url: string;
  /** Language of the page, as a BCP 47 tag. */
  lang: string;
  logo?: OgImage;
  /** Image covering the card, from the `background` option. */
  background?: OgImage;
  colors: OgColors;
  /** Family of the `font` option, or Geist. */
  fontFamily: string;
  options: OgOptions;
  width: number;
  height: number;
}

/**
 * Draws a card. The default export of the module named by the `template` option; it can
 * return its own tree, or wrap `defaultTemplate`.
 */
export type OgTemplate = (props: OgTemplateProps) => OgNode | Promise<OgNode>;

/** A node of the card, as satori reads it. */
export interface OgNode {
  type: string;
  props: Record<string, unknown>;
}

export type OgChild = OgNode | string | number | false | null | undefined | OgChild[];

/**
 * Builds a node, with the signature of a JSX factory: `h('div', { style }, 'Text')`.
 * Falsy children are dropped, so `cond && h(…)` works.
 */
export function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: OgChild[]
): OgNode {
  const list: (OgNode | string | number)[] = [];
  const add = (child: OgChild): void => {
    if (Array.isArray(child)) child.forEach(add);
    else if (child !== false && child !== null && child !== undefined) list.push(child);
  };
  children.forEach(add);
  return {
    type,
    props: {
      ...props,
      ...(list.length === 0 ? {} : { children: list.length === 1 ? list[0] : list }),
    },
  };
}

function el(type: string, style: Record<string, unknown>, ...children: OgChild[]): OgNode {
  return h(type, { style }, ...children);
}

/** The built-in card, in the layout chosen by the `layout` option. */
export function defaultTemplate(props: OgTemplateProps): OgNode {
  const { colors, options } = props;
  const layout = { default: defaultLayout, centered: centeredLayout, split: splitLayout }[
    options.layout
  ];
  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: colors.background,
      color: colors.text,
      fontFamily: props.fontFamily,
    },
    props.background &&
      h('img', {
        src: props.background.src,
        width: props.width,
        height: props.height,
        style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' },
      }),
    el('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      ...backdrop(options.backdrop, colors),
    }),
    options.accentBar &&
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 8,
        backgroundImage: `linear-gradient(90deg, ${colors.accent}, ${toRgba(colors.accent, 0)})`,
      }),
    // Positioned, like the layers above, so it is painted after them.
    el(
      'div',
      { display: 'flex', position: 'relative', width: '100%', height: '100%' },
      layout(props),
    ),
  );
}

/** Three rows spread over the card: a header, the text and a footer. */
function rows(top: OgChild, middle: OgChild, bottom: OgChild, align = 'stretch'): OgNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: align,
      width: '100%',
      height: '100%',
      padding: '76px 80px',
      // Satori sizes boxes like CSS, padding included only with `border-box`.
      boxSizing: 'border-box',
    },
    // Empty rows keep their place, so the text stays where the layout puts it.
    el('div', { display: 'flex', alignItems: 'center', gap: 24 }, top),
    middle,
    el('div', { display: 'flex', alignItems: 'center', gap: 24 }, bottom),
  );
}

/** Two ends of a row, pushed apart. */
function ends(left: OgChild, right: OgChild): OgNode {
  return el(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flex: 1 },
    el('div', { display: 'flex', alignItems: 'center' }, left),
    el('div', { display: 'flex', alignItems: 'center' }, right),
  );
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The brand in its corner; the breadcrumb and badges at the bottom, or above when it is there. */
function defaultLayout(props: OgTemplateProps): OgNode {
  const position = brandPosition(props);
  const corners: Partial<Record<Corner, OgChild>> = { [position]: brand(props) };
  const free = (side: 'left' | 'right'): Corner =>
    position === `bottom-${side}` ? `top-${side}` : `bottom-${side}`;
  corners[free('left')] = section(props);
  corners[free('right')] = badges(props);

  return rows(
    ends(corners['top-left'], corners['top-right']),
    text(props, 'left'),
    ends(corners['bottom-left'], corners['bottom-right']),
  );
}

/** Everything on the center line, with the brand above or below the text. */
function centeredLayout(props: OgTemplateProps): OgNode {
  const top = brandPosition(props).startsWith('top');
  const meta = el(
    'div',
    { display: 'flex', alignItems: 'center', gap: 24 },
    section(props),
    badges(props),
  );
  return rows(
    top ? brand(props) : meta,
    text(props, 'center'),
    top ? meta : brand(props),
    'center',
  );
}

/** The text on the left, the logo drawn large on the right. */
function splitLayout(props: OgTemplateProps): OgNode {
  const { logo, siteName } = props;
  const top = brandPosition(props).startsWith('top');
  const name = siteName && el('div', SITE_NAME_STYLE, siteName);
  const meta = ends(section(props), badges(props));
  return el(
    'div',
    { display: 'flex', width: '100%', height: '100%' },
    el(
      'div',
      { display: 'flex', flex: 1 },
      rows(top ? name : meta, text(props, 'left'), top ? meta : name),
    ),
    logo &&
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 400,
          height: '100%',
          paddingRight: 80,
        },
        image(scale(logo, 240)),
      ),
  );
}

function brandPosition({ options }: OgTemplateProps): Corner {
  return options.logo ? options.logo.position : 'top-left';
}

const SITE_NAME_STYLE = { fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' };

function brand({ logo, siteName }: OgTemplateProps): OgChild {
  if (!logo && !siteName) return undefined;
  return el(
    'div',
    { display: 'flex', alignItems: 'center', gap: 18 },
    logo && image(logo),
    siteName && el('div', SITE_NAME_STYLE, siteName),
  );
}

function text({ title, description, colors }: OgTemplateProps, align: 'left' | 'center'): OgNode {
  const heading = truncate(title, 70);
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      textAlign: align,
    },
    el(
      'div',
      {
        fontSize: heading.length > 40 ? 58 : 70,
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: '-0.035em',
      },
      heading,
    ),
    description &&
      el(
        'div',
        { fontSize: 30, lineHeight: 1.4, color: colors.muted, marginTop: 20 },
        truncate(description, 130),
      ),
  );
}

function section({ section, colors }: OgTemplateProps): OgChild {
  return (
    section &&
    el('div', { display: 'flex', fontSize: 22, color: colors.muted }, truncate(section, 60))
  );
}

function badges({ badges, colors }: OgTemplateProps): OgChild {
  if (badges.length === 0) return undefined;
  return el(
    'div',
    { display: 'flex', gap: 12 },
    badges.map((badge) =>
      el(
        'div',
        {
          display: 'flex',
          fontSize: 20,
          color: colors.muted,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: '8px 18px',
        },
        badge,
      ),
    ),
  );
}

function image({ src, width, height }: OgImage): OgNode {
  return h('img', { src, width, height, style: { display: 'flex' } });
}

/** The same image at another height, in proportion. */
function scale(image: OgImage, height: number): OgImage {
  return { ...image, width: Math.round((image.width / image.height) * height), height };
}

/** Background of the card, drawn with the accent so it matches the site. */
function backdrop(name: OgOptions['backdrop'], { accent, background }: OgColors) {
  const faint = toRgba(accent, 0.14);
  // Fades the pattern out towards the bottom right, where the text sits, and lets a
  // background image show through.
  const fade = 'radial-gradient(circle at 0% 0%, black, transparent 75%)';
  switch (name) {
    case 'glow':
      // The site anchors its backdrop to the top left, the card does the same.
      return {
        backgroundImage: `radial-gradient(circle at 12% 0%, ${toRgba(accent, 0.22)}, ${toRgba(background, 0)} 55%)`,
      };
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${faint} 1px, transparent 1px), linear-gradient(90deg, ${faint} 1px, transparent 1px)`,
        backgroundSize: '48px 48px, 48px 48px',
        maskImage: fade,
      };
    case 'dots':
      return {
        // satori reads the stops of a radial gradient as percentages only.
        backgroundImage: `radial-gradient(${toRgba(accent, 0.5)} 8%, ${toRgba(accent, 0)} 12%)`,
        backgroundSize: '24px 24px',
        maskImage: fade,
      };
    case 'none':
      return {};
  }
}

/** Cut on a word boundary when there is one close enough to the limit. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
