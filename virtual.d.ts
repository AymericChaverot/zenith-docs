declare module '*.astro' {
  const Component: (props: Record<string, any>) => any;
  export default Component;
}

declare module 'virtual:zenith/config' {
  const config: import('./src/config').ZenithConfig;
  export default config;
}

declare module 'virtual:zenith/project' {
  /** Absolute path of the Astro project root, with forward slashes. */
  export const root: string;
  /** Shiki themes of the site, used to highlight code outside the Markdown pipeline. */
  export const shikiThemes: Record<string, string>;
}

declare module 'virtual:zenith/og-assets' {
  /** Font files embedded in Open Graph images, the family of the card first. */
  export const fonts: import('./src/og').OgFontFile[];
  /** Absolute path of the resvg WebAssembly binary. */
  export const wasm: string;
  /** Absolute path of the logo, when it is not an SVG inlined in the config. */
  export const logo: string | undefined;
  /** Absolute path of the background image. */
  export const background: string | undefined;
}

declare module 'virtual:zenith/user-css' {}

declare module 'virtual:zenith/slots' {
  /** Components added to each place of the layout, in the order they were declared. */
  const slots: Record<
    import('./src/virtual').SlotName,
    ((props: Record<string, unknown>) => unknown)[]
  >;
  export default slots;
}

declare module 'virtual:zenith/built-with' {
  /** Projects the site is built with and their versions, empty when `builtWith` is off. */
  const builtWith: import('./src/built-with').BuiltWithEntry[];
  export default builtWith;
}

declare module 'virtual:zenith/components/*' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
