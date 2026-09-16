import type { APIRoute } from 'astro';
import svg from '../assets/favicon.svg?raw';

/** The ZenithDocs favicon, served when a project has none of its own. */
export const GET: APIRoute = () =>
  new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
