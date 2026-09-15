// @ts-check
import { defineConfig } from 'astro/config';
import zenith from 'zenith-docs';

export default defineConfig({
  integrations: [
    zenith({
      title: 'ZenithDocs',
      description: 'A static, lightweight and themeable documentation engine for Astro.',
      logo: { src: '/logo.svg', alt: 'ZenithDocs' },
      lastUpdated: true,
      links: [{ label: 'Astro', href: 'https://docs.astro.build' }],
    }),
  ],
});
