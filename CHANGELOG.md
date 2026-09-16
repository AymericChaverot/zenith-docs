# Changelog

## 0.1.0

The first release.

### Getting started

- `npx github:AymericChaverot/zenith-docs create` sets up a site, as a config file and a folder of Markdown, or as an Astro project with the integration. New sites are pinned to the release that created them.
- The `zenith` CLI runs a site with no Astro project: `dev`, `build`, `preview`, `init` and `docker`.
- The Astro integration adds ZenithDocs to an existing Astro 7 project.

### Content

- Markdown and MDX, with GitHub Flavored Markdown, callouts and GitHub alerts, heading anchors and custom ids.
- Code blocks highlighted at build time with Shiki: titles, line and word highlights, diffs, focus, line numbers and a copy button.
- Built-in components: callouts, cards, tabs, steps, accordions, file trees and icons.
- Navigation ordered with `meta.json` files, following the Fumadocs conventions, with sidebar tabs.

### Features

- Static full-text search with Pagefind, loaded only when it is opened.
- Internationalization, with a fallback for untranslated pages.
- Versioning, each version with its own navigation.
- OpenAPI reference pages rendered at build time.
- `llms.txt`, `llms-full.txt` and a Markdown version of every page.
- An Open Graph image generated for every page.
- Edit links and last updated dates from git.

### Customization

- Five packaged themes, six accents, ten backdrops and seven self-hosted font pairings.
- Design tokens and cascade layers, so custom CSS always wins.
- Component overrides and slots.
- A theme builder in the documentation, which writes the files to reproduce a look.
- The ZenithDocs logo, favicon and title as defaults, for anything a project leaves unset.

### Deployment

- A static build that works under any `base` path.
- A generated Dockerfile: the site served by unprivileged nginx, in an image of about 30 MB.
