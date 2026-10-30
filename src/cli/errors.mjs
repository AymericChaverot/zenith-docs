/**
 * The text printed when a command fails. Errors are often wrapped, and the useful part
 * is the innermost cause. Astro errors keep their details in `hint`, such as the list
 * of invalid options, so it is printed under the message.
 */
export function formatError(error) {
  const lines = [];
  for (
    let current = error;
    current;
    current = current instanceof Error ? current.cause : undefined
  ) {
    lines.push(
      `${lines.length === 0 ? '' : 'Caused by: '}${current instanceof Error ? current.message : String(current)}`,
    );
    if (current instanceof Error && typeof current.hint === 'string' && current.hint) {
      lines.push(current.hint);
    }
  }
  return lines.join('\n');
}
