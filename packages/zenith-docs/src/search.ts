import { fileURLToPath } from 'node:url';
import type { AstroIntegrationLogger } from 'astro';
// Astro loads the configuration with a temporary Vite module runner and closes it before running
// integration hooks, so Pagefind has to be imported here rather than from inside the hook.
import * as pagefind from 'pagefind';

interface PagefindResponse {
  errors: string[];
}

/** Index the built site with Pagefind, writing the index next to the pages. */
export async function buildSearchIndex(dir: URL, logger: AstroIntegrationLogger) {
  try {
    const { index } = assertNoErrors(await pagefind.createIndex(), logger);
    if (!index) throw new Error('Pagefind returned no index.');

    const { page_count } = assertNoErrors(
      await index.addDirectory({ path: fileURLToPath(dir) }),
      logger,
    );
    assertNoErrors(
      await index.writeFiles({ outputPath: fileURLToPath(new URL('./pagefind/', dir)) }),
      logger,
    );

    logger.info(`Indexed ${page_count} page(s) for search.`);
  } catch (cause) {
    throw new Error('Failed to build the search index with Pagefind.', { cause });
  } finally {
    await pagefind.close();
  }
}

function assertNoErrors<T extends PagefindResponse>(response: T, logger: AstroIntegrationLogger) {
  if (response.errors.length > 0) {
    for (const error of response.errors) logger.error(error);
    throw new Error('Pagefind reported errors.');
  }
  return response;
}
