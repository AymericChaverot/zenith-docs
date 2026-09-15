declare module 'virtual:zenith/config' {
  const config: import('./src/config').ZenithConfig;
  export default config;
}

declare module 'virtual:zenith/project' {
  /** Absolute path of the Astro project root, with forward slashes. */
  export const root: string;
}

declare module 'virtual:zenith/user-css' {}

declare module 'virtual:zenith/components/*' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
