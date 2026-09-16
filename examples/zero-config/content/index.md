---
title: Zero Config
description: A documentation site with no Astro configuration at all.
---

This site is a `zenith.config.ts` file and a folder of Markdown. There is no `astro.config.mjs`, no `content.config.ts` and no `src` directory: the CLI generates what Astro needs in `.zenith/`, and rewrites it on every run.

```bash
zenith dev
zenith build
```

Everything the integration offers is available here too: search, callouts, code blocks and the rest.
