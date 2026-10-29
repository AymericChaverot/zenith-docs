export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** Flags that mean a development dependency, as each manager spells them. */
const DEV_FLAG: Record<PackageManager, string> = { npm: '-D', pnpm: '-D', yarn: '-D', bun: '-d' };

/** Rewrite one shell line written for npm for another package manager. */
export function convertCommand(line: string, pm: PackageManager): string {
  if (pm === 'npm') return line;

  const npx = /^(\s*)npx\s+(.*)$/.exec(line);
  if (npx) {
    const [, indent, rest] = npx;
    return `${indent}${pm === 'bun' ? 'bunx' : `${pm} dlx`} ${rest}`;
  }

  const match = /^(\s*)npm\s+(\S+)(.*)$/.exec(line);
  if (!match) return line;
  const [, indent, command, rest = ''] = match;
  const args = rest.trim().split(/\s+/).filter(Boolean);

  switch (command) {
    case 'i':
    case 'install':
    case 'add': {
      if (args.every((arg) => arg.startsWith('-')) && !args.some(isGlobal)) {
        return `${indent}${pm} install${rest}`;
      }
      const global = args.some(isGlobal);
      const words = args
        .filter((arg) => !isGlobal(arg))
        .map((arg) => (arg === '-D' || arg === '--save-dev' ? DEV_FLAG[pm] : arg));
      if (global && pm === 'yarn') return `${indent}yarn global add ${words.join(' ')}`;
      return `${indent}${pm} add ${[...(global ? ['-g'] : []), ...words].join(' ')}`;
    }
    case 'uninstall':
    case 'remove':
    case 'rm':
      return `${indent}${pm} remove${rest}`;
    case 'run':
      // Yarn runs scripts without `run`, the others accept it.
      return `${indent}${pm === 'yarn' ? 'yarn' : `${pm} run`}${rest}`;
    case 'exec':
      return `${indent}${pm === 'bun' ? 'bunx' : `${pm} exec`}${rest.replace(/^\s+--(?=\s)/, '')}`;
    default:
      return `${indent}${pm} ${command}${rest}`;
  }
}

function isGlobal(arg: string) {
  return arg === '-g' || arg === '--global';
}
