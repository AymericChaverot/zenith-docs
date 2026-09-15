import type { APIRoute } from 'astro';
import config from 'virtual:zenith/config';
import { renderLlmsFull } from '../llms';
import { getLlmsData, TEXT_HEADERS } from '../llms-data';

export const GET: APIRoute = async ({ site }) => {
  const { sections, pages } = await getLlmsData(site);
  const body = renderLlmsFull({
    title: config.title,
    description: config.description,
    sections,
    pages,
  });
  return new Response(body, { headers: TEXT_HEADERS });
};
