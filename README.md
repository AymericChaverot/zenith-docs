# ZenithDocs

Moteur de documentation statique, léger et thémable, basé sur [Astro](https://astro.build) et le système de tokens [Lumos](https://lumosframework.com).

## Démarrer

ZenithDocs n'est pas publié sur npm : il s'installe directement depuis ce dépôt, dont la racine est le paquet. Il faut Node.js 22.18 ou plus, et Git.

```sh
npx github:AymericChaverot/zenith-docs create my-docs
```

La commande pose quelques questions (dossier, titre, gabarit, thème) et peut installer les dépendances. C'est la même commande `zenith` que celle utilisée ensuite dans le projet (`zenith dev`, `zenith build`). Pour l'ajouter à un projet Astro existant :

```sh
npm install github:AymericChaverot/zenith-docs
```

Ajouter `#v0.1.0` (un tag) ou un hash de commit fige une version.

## Structure

```
src/                   intégration Astro et CLI `zenith`
test/                  tests unitaires
apps/docs              documentation de ZenithDocs, construite avec ZenithDocs
examples/zero-config   site sans configuration Astro, via la CLI
```

La racine est à la fois le paquet `zenith-docs` et la racine du workspace pnpm. Le champ `files` du `package.json` limite ce qui est installé à `src/`, ni la démo ni les exemples ne sont téléchargés.

## Développement

```sh
corepack pnpm install
corepack pnpm dev      # site de démo
corepack pnpm test     # tests unitaires
corepack pnpm check    # vérification des types
corepack pnpm build    # build statique de la démo
```
