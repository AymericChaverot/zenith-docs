/**
 * Runtime of `zenith-docs/config`, which a `zenith.config.ts` file imports.
 *
 * The CLI loads that file with Node, and Node will not run TypeScript from `node_modules`,
 * so what executes is this plain module. The types still come from `config.ts`.
 *
 * @param {import('./config.ts').ZenithUserConfig} config
 */
export function defineConfig(config) {
  return config;
}
