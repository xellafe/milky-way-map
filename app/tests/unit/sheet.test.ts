import { describe, expect, it } from 'vitest';
import { centerShift, sheetContent } from '../../src/lib/sheet';

const none = {
  view: 'galaxy' as const,
  hasStar: false,
  hasPlanet: false,
  dockPanel: null,
  musicExpanded: false,
};

describe('sheetContent', () => {
  it.each([
    [
      'open dock panel beats a selected star',
      { hasStar: true, dockPanel: 'filters' as const },
      'dock',
    ],
    ['expanded music beats a selected star', { hasStar: true, musicExpanded: true }, 'music'],
    ['dock beats music', { dockPanel: 'view' as const, musicExpanded: true }, 'dock'],
    ['galaxy with a star shows the star card', { hasStar: true }, 'star'],
    ['system without a planet shows the system', { view: 'system' as const }, 'system'],
    [
      'system with a planet shows the planet',
      { view: 'system' as const, hasPlanet: true },
      'planet',
    ],
    ['galaxy with nothing selected shows nothing', {}, null],
  ])('%s', (_name, patch, expected) => {
    expect(sheetContent({ ...none, ...patch })).toBe(expected);
  });
});

describe('centerShift', () => {
  it('moves the centre up to the middle of the area above a bottom sheet', () => {
    expect(centerShift({ left: 0, top: 0, right: 375, bottom: 487 }, 375, 812)).toEqual({
      x: 0,
      y: -162.5,
    });
  });
});
