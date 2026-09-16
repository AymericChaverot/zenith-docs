# ZenithDocs

Moteur de documentation statique, léger et thémable, basé sur [Astro](https://astro.build) et le système de tokens [Lumos](https://lumosframework.com).

## Démarrer

ZenithDocs n'est pas publié sur npm : il s'installe directement depuis ce dépôt. Il faut Node.js 22.18 ou plus, et Git.

```sh
npx github:AymericChaverot/zenith-docs#create my-docs
```

La commande pose quelques questions (dossier, titre, gabarit, thème) et peut installer les dépendances. Pour l'ajouter à un projet Astro existant :

```sh
pnpm add github:AymericChaverot/zenith-docs#zenith-docs
```

## Structure

```
packages/zenith-docs          intégration Astro et CLI `zenith` (cœur)
packages/create-zenith-docs   générateur de projet
apps/docs                     documentation de ZenithDocs, construite avec ZenithDocs
examples/zero-config          site sans configuration Astro, via la CLI
```

## Distribution

Les gestionnaires de paquets ne savent pas installer un sous-dossier d'un dépôt. À chaque push sur `main`, une GitHub Action vérifie le code puis copie chaque paquet sur sa propre branche, à la racine :

| Branche       | Contenu                           |
| ------------- | --------------------------------- |
| `zenith-docs` | `packages/zenith-docs`            |
| `create`      | `packages/create-zenith-docs`     |

Ces branches sont générées : on ne les modifie jamais à la main.

## Développement

```sh
corepack pnpm install
corepack pnpm dev      # site de démo
corepack pnpm test     # tests unitaires
corepack pnpm build    # build statique
```
