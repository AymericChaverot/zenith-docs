# ZenithDocs

A static, lightweight and themeable documentation engine, built on [Astro](https://astro.build) and the [Lumos](https://lumosframework.com) design tokens.

- **Static by design**: every page is prerendered to HTML and CSS. The sidebar, table of contents, accordions and file trees work without JavaScript.
- **One command to start**: a config file and a folder of Markdown are enough, no Astro project required.
- **Batteries included**: full-text search, internationalization, versioning, OpenAPI reference pages, `llms.txt`, and an Open Graph image for every page.
- **Themeable**: packaged themes, seven font pairings, CSS tokens, component overrides and slots, and a theme builder to try it all.

## Getting started

ZenithDocs is not published to the npm registry: it installs straight from this repository, whose root is the package. It needs Node.js 22.18 or later, and Git.

```sh
npx github:AymericChaverot/zenith-docs create my-docs
```

The command asks for a directory, a title, a template and a theme, and can install the dependencies. It is the same `zenith` command you then use in the project: `zenith dev`, `zenith build`, `zenith preview`.

To add ZenithDocs to an existing Astro project instead:

```sh
npm install github:AymericChaverot/zenith-docs
```

Append a tag, such as `#v0.1.0`, or a commit hash to pin a version.

## Documentation

The documentation site lives in [`apps/docs`](apps/docs). It is built with ZenithDocs, and demonstrates every feature as it documents it.

## Repository layout

```
src/                   Astro integration, components and the zenith CLI
test/                  unit tests
apps/docs              documentation site, built with ZenithDocs
examples/zero-config   site with no Astro configuration, run by the CLI
```

The root is both the `zenith-docs` package and the root of the pnpm workspace. The `files` field of `package.json` limits what gets installed to `src/`: neither the documentation site nor the examples are downloaded.

## Development

```sh
corepack pnpm install
corepack pnpm dev      # documentation site
corepack pnpm test     # unit tests
corepack pnpm check    # type checking
corepack pnpm build    # static build of the documentation site
```

## License

[MIT](LICENSE)
