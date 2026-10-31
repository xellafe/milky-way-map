import { describe, expect, it, vi } from 'vitest';

const readUsableArea = vi.fn();
vi.mock('../../src/scene/usableArea', () => ({ readUsableArea }));

import { placeAnchor } from '../../src/scene/placeAnchor';

function stubEl() {
  const slot = {
    offsetWidth: 200,
    offsetHeight: 100,
    style: { translate: '', setProperty: vi.fn() },
  };
  const el = {
    querySelector: vi.fn(() => slot),
    style: { visibility: '', transform: '' },
    dataset: {} as Record<string, string>,
  };
  return { el, slot };
}

describe('placeAnchor', () => {
  it('uses the given area and never reads the layout', () => {
    const { el, slot } = stubEl();
    const area = { left: 0, top: 50, right: 1000, bottom: 700 };
    placeAnchor(el as unknown as HTMLElement, 300, 400, true, area);
    expect(readUsableArea).not.toHaveBeenCalled();
    expect(el.dataset.side).toMatch(/^(left|right)$/);
    expect(el.style.transform).toBe('translate(300.0px, 400.0px)');
    expect(el.style.visibility).toBe('visible');
    expect(slot.style.translate).toMatch(/^0 -?\d+(\.\d)?px$/);
    expect(slot.style.setProperty).toHaveBeenCalledWith('--card-max-h', '650px');
  });
});
