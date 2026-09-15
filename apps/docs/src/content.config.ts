import { defineCollection } from 'astro:content';
import { docsLoader, docsSchema, metaLoader, metaSchema } from 'zenith-docs/content';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  meta: defineCollection({ loader: metaLoader(), schema: metaSchema() }),
};
