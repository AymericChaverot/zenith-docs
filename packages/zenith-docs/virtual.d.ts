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
}

declare module 'virtual:zenith/og-assets' {
  /** Absolute paths of the Geist WOFF files embedded in Open Graph images. */
  export const fonts: { weight: import('./src/og').OgFontWeight; path: string }[];
  /** Absolute path of the resvg WebAssembly binary. */
  export const wasm: string;
}

declare module 'virtual:zenith/user-css' {}

declare module 'virtual:zenith/components/*' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
