import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';

let dates: Map<string, Date> | undefined;

/** Date of the last commit touching `filePath` (relative to `root`), read once from `git log`. */
export function getLastUpdated(root: string, filePath: string): Date | undefined {
  dates ??= readGitDates(root);
  return dates.get(filePath.replaceAll('\\', '/'));
}

function readGitDates(root: string): Map<string, Date> {
  const result = new Map<string, Date>();
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const toplevel = git(['rev-parse', '--show-toplevel']).trim();
    const prefix = relative(toplevel, root).replaceAll('\\', '/');
    const log = git(['log', '--format=t:%ct', '--name-only', '--no-renames', '--', '.']);

    let current: Date | undefined;
    for (const line of log.split('\n')) {
      if (line.startsWith('t:')) {
        current = new Date(Number(line.slice(2)) * 1000);
      } else if (line && current) {
        const path = prefix && line.startsWith(`${prefix}/`) ? line.slice(prefix.length + 1) : line;
        if (!result.has(path)) result.set(path, current);
      }
    }
  } catch {
    // Not a git checkout: no dates.
  }
  return result;
}
