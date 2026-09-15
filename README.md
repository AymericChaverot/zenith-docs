# ZenithDocs

Moteur de documentation statique, léger et thémable, basé sur [Astro](https://astro.build) et le système de tokens [Lumos](https://lumosframework.com).

## Structure

```
packages/zenith-docs   intégration Astro (cœur)
apps/docs              documentation de ZenithDocs, construite avec ZenithDocs
```

## Développement

```sh
corepack pnpm install
corepack pnpm dev      # site de démo
corepack pnpm test     # tests unitaires
corepack pnpm build    # build statique
```
