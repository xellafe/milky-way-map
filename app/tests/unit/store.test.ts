import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_TIME_SCALE_DAYS_PER_SECOND, useGalaxyMapStore } from '../../src/state/store';

const initialState = useGalaxyMapStore.getState();

describe('galaxy map store', () => {
  beforeEach(() => {
    useGalaxyMapStore.setState(initialState, true);
  });

  it('matches SPEC §13 defaults: no selection, free-fly, galaxy view, toggles off', () => {
    const s = useGalaxyMapStore.getState();
    expect(s.selection).toBeNull();
    expect(s.hoveredStarIndex).toBeNull();
    expect(s.cameraMode).toBe('free-fly');
    expect(s.view).toBe('galaxy');
    expect(s.showNames).toBe(false);
    expect(s.showConstellations).toBe(false);
    expect(s.showHabitableZone).toBe(false);
  });

  it('defaults time scale to 1 real second = 2 days (SPEC §13)', () => {
    expect(DEFAULT_TIME_SCALE_DAYS_PER_SECOND).toBe(2);
    expect(useGalaxyMapStore.getState().timeScaleDaysPerSecond).toBe(2);
  });

  it('selects and deselects a star', () => {
    useGalaxyMapStore.getState().selectStar(42);
    expect(useGalaxyMapStore.getState().selection).toEqual({ kind: 'star', index: 42 });
    useGalaxyMapStore.getState().selectStar(null);
    expect(useGalaxyMapStore.getState().selection).toBeNull();
  });

  it('selects an unmatched exoplanet host (e.g. TRAPPIST-1)', () => {
    useGalaxyMapStore.getState().selectHost('TRAPPIST-1');
    expect(useGalaxyMapStore.getState().selection).toEqual({
      kind: 'host',
      hostname: 'TRAPPIST-1',
    });
  });

  it('locking a star switches the camera to orbit; deselecting releases it (SPEC §6.3)', () => {
    useGalaxyMapStore.getState().selectStar(42);
    expect(useGalaxyMapStore.getState().cameraMode).toBe('orbit');
    useGalaxyMapStore.getState().selectStar(null);
    expect(useGalaxyMapStore.getState().cameraMode).toBe('free-fly');
  });

  it('selecting a host (not in the cloud) does NOT orbit', () => {
    useGalaxyMapStore.getState().selectStar(42);
    useGalaxyMapStore.getState().selectHost('TRAPPIST-1');
    expect(useGalaxyMapStore.getState().cameraMode).toBe('free-fly');
  });

  it('releasing orbit via setCameraMode keeps the selection', () => {
    useGalaxyMapStore.getState().selectStar(42);
    useGalaxyMapStore.getState().setCameraMode('free-fly');
    expect(useGalaxyMapStore.getState().cameraMode).toBe('free-fly');
    expect(useGalaxyMapStore.getState().selection).toEqual({ kind: 'star', index: 42 });
  });

  it('fly-to request is one-shot', () => {
    useGalaxyMapStore.getState().requestFlyTo([1, 2, 3]);
    expect(useGalaxyMapStore.getState().pendingFlyTo).toEqual([1, 2, 3]);
    useGalaxyMapStore.getState().clearFlyTo();
    expect(useGalaxyMapStore.getState().pendingFlyTo).toBeNull();
  });

  it('accepts time scale 0 as paused', () => {
    useGalaxyMapStore.getState().setTimeScale(0);
    expect(useGalaxyMapStore.getState().timeScaleDaysPerSecond).toBe(0);
  });

  it('toggles flags independently', () => {
    useGalaxyMapStore.getState().toggleNames();
    expect(useGalaxyMapStore.getState().showNames).toBe(true);
    expect(useGalaxyMapStore.getState().showConstellations).toBe(false);
  });

  it('enters and exits the System View keeping the galaxy selection', () => {
    useGalaxyMapStore.getState().selectStar(584);
    useGalaxyMapStore.getState().enterSystemView('Proxima Cen');
    let s = useGalaxyMapStore.getState();
    expect(s.view).toBe('system');
    expect(s.systemHostname).toBe('Proxima Cen');
    expect(s.selectedPlanet).toBeNull();
    useGalaxyMapStore.getState().selectPlanet('Proxima Cen b');
    useGalaxyMapStore.getState().exitSystemView();
    s = useGalaxyMapStore.getState();
    expect(s.view).toBe('galaxy');
    expect(s.systemHostname).toBeNull();
    expect(s.selectedPlanet).toBeNull();
    expect(s.selection).toEqual({ kind: 'star', index: 584 });
  });

  it('bumps the labels version monotonically', () => {
    const before = useGalaxyMapStore.getState().labelsVersion;
    useGalaxyMapStore.getState().bumpLabelsVersion();
    useGalaxyMapStore.getState().bumpLabelsVersion();
    expect(useGalaxyMapStore.getState().labelsVersion).toBe(before + 2);
  });

  it('shows every planet type by default and toggles one', () => {
    expect(Object.values(useGalaxyMapStore.getState().visiblePlanetTypes)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    useGalaxyMapStore.getState().togglePlanetType('giant');
    expect(useGalaxyMapStore.getState().visiblePlanetTypes.giant).toBe(false);
    expect(useGalaxyMapStore.getState().visiblePlanetTypes.rocky).toBe(true);
  });

  it('dock: one panel at a time, toggle closes', () => {
    const s = () => useGalaxyMapStore.getState();
    expect(s().dockPanel).toBeNull();
    s().toggleDockPanel('filters');
    expect(s().dockPanel).toBe('filters');
    s().toggleDockPanel('music');
    expect(s().dockPanel).toBe('music');
    s().toggleDockPanel('music');
    expect(s().dockPanel).toBeNull();
  });

  it('dock: view changes close the open panel', () => {
    const s = () => useGalaxyMapStore.getState();
    s().toggleDockPanel('filters');
    s().enterSystemView('TRAPPIST-1');
    expect(s().dockPanel).toBeNull();
    s().toggleDockPanel('options');
    s().exitSystemView();
    expect(s().dockPanel).toBeNull();
  });

  it('overlay reopens on every star selection, even the same star', () => {
    const s = () => useGalaxyMapStore.getState();
    s().selectStar(7);
    expect(s().selectionOverlayOpen).toBe(true);
    s().closeSelectionOverlay();
    expect(s().selectionOverlayOpen).toBe(false);
    s().selectStar(7);
    expect(s().selectionOverlayOpen).toBe(true);
  });

  it('overlay state survives the System View round trip', () => {
    const s = () => useGalaxyMapStore.getState();
    s().selectStar(7);
    s().closeSelectionOverlay();
    s().enterSystemView('X');
    s().exitSystemView();
    expect(s().selectionOverlayOpen).toBe(false);
  });
});
