// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import zenith from 'zenith-docs';

const fontsource = fontProviders.fontsource();

export default defineConfig({
  site: 'https://aymericchaverot.github.io',
  // GitHub Pages serves the site from /zenith-docs/. The deploy workflow sets DOCS_BASE, so
  // the local dev server and previews stay at the root.
  base: process.env.DOCS_BASE,
  // Families compared on /customization/typography/, loaded only by that page.
  fonts: [
    { provider: fontsource, name: 'Geist', cssVariable: '--font-geist', weights: ['400 700'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontsource, name: 'Geist Mono', cssVariable: '--font-geist-mono', weights: ['400 700'], subsets: ['latin'], fallbacks: ['monospace'] },
    { provider: fontsource, name: 'Newsreader', cssVariable: '--font-newsreader', weights: ['400 700'], subsets: ['latin'], fallbacks: ['serif'] },
    { provider: fontsource, name: 'Onest', cssVariable: '--font-onest', weights: ['400 700'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontsource, name: 'IBM Plex Mono', cssVariable: '--font-ibm-plex-mono', weights: [400, 600], subsets: ['latin'], fallbacks: ['monospace'] },
    { provider: fontsource, name: 'Schibsted Grotesk', cssVariable: '--font-schibsted-grotesk', weights: ['400 700'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontsource, name: 'JetBrains Mono', cssVariable: '--font-jetbrains-mono', weights: ['400 700'], subsets: ['latin'], fallbacks: ['monospace'] },
    { provider: fontsource, name: 'Space Grotesk', cssVariable: '--font-space-grotesk', weights: ['400 700'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontsource, name: 'Space Mono', cssVariable: '--font-space-mono', weights: [400, 700], subsets: ['latin'], fallbacks: ['monospace'] },
    { provider: fontsource, name: 'Atkinson Hyperlegible', cssVariable: '--font-atkinson', weights: [400, 700], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontsource, name: 'Literata', cssVariable: '--font-literata', weights: ['400 700'], subsets: ['latin'], fallbacks: ['serif'] },
  ],
  integrations: [
    zenith({
      title: 'ZenithDocs',
      description: 'A static, lightweight and themeable documentation engine for Astro.',
      github: 'https://github.com/AymericChaverot/zenith-docs',
      editLink: { baseUrl: 'https://github.com/AymericChaverot/zenith-docs/edit/main/apps/docs/' },
      lastUpdated: true,
      openapi: {
        rockets: './src/openapi/rockets.yaml',
      },
      slots: {
        sidebarBottom: './src/components/SidebarPromo.astro',
      },
      locales: {
        root: { label: 'English' },
        fr: { label: 'Français' },
      },
    }),
  ],
});
