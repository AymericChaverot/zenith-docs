import { describe, expect, it } from 'vitest';
import { SLOT_NAMES, slotsModule } from '../src/virtual';

const identity = (path: string) => path;

describe('slotsModule', () => {
  it('lists every slot, empty ones included', () => {
    const code = slotsModule({}, identity);
    for (const name of SLOT_NAMES) expect(code).toContain(`  ${name}: [],`);
    expect(code).not.toContain('import ');
  });

  it('imports each component once, in declaration order', () => {
    const code = slotsModule(
      { banner: './Banner.astro', sidebarBottom: ['./A.astro', './B.astro'] },
      identity,
    );
    expect(code).toContain('import Slot0 from "./Banner.astro";');
    expect(code).toContain('import Slot1 from "./A.astro";');
    expect(code).toContain('import Slot2 from "./B.astro";');
    expect(code).toContain('  banner: [Slot0],');
    expect(code).toContain('  sidebarBottom: [Slot1, Slot2],');
  });

  it('resolves paths from the project root', () => {
    const code = slotsModule({ footer: './Footer.astro' }, (path) => `/project/${path.slice(2)}`);
    expect(code).toContain('import Slot0 from "/project/Footer.astro";');
  });
});
