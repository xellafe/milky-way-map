import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  MUSIC_COLLAPSED_KEY,
  useGalaxyMapStore,
} from '../../src/state/store';

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
    s().toggleDockPanel('view');
    expect(s().dockPanel).toBe('view');
    s().toggleDockPanel('view');
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

  it('selecting the same star twice bumps selectionEpoch', () => {
    const s = () => useGalaxyMapStore.getState();
    s().selectStar(7);
    const before = s().selectionEpoch;
    s().selectStar(7);
    expect(s().selectionEpoch).toBeGreaterThan(before);
  });

  it('overlay state survives the System View round trip', () => {
    const s = () => useGalaxyMapStore.getState();
    s().selectStar(7);
    s().closeSelectionOverlay();
    s().enterSystemView('X');
    s().exitSystemView();
    expect(s().selectionOverlayOpen).toBe(false);
  });

  it('setWelcomeOpen toggles welcomeOpen', () => {
    const s = () => useGalaxyMapStore.getState();
    s().setWelcomeOpen(false);
    expect(s().welcomeOpen).toBe(false);
    s().setWelcomeOpen(true);
    expect(s().welcomeOpen).toBe(true);
  });

  describe('music player state', () => {
    const s = () => useGalaxyMapStore.getState();

    function stubEnv(compact: boolean): Storage {
      const data = new Map<string, string>();
      const storage = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      } as unknown as Storage;
      vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('window', { matchMedia: () => ({ matches: compact }) });
      return storage;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('setMusicExpanded updates the state and persists the collapsed flag', () => {
      const storage = stubEnv(false);
      s().setMusicExpanded(false);
      expect(s().musicExpanded).toBe(false);
      expect(storage.getItem(MUSIC_COLLAPSED_KEY)).toBe('1');
      s().setMusicExpanded(true);
      expect(s().musicExpanded).toBe(true);
      expect(storage.getItem(MUSIC_COLLAPSED_KEY)).toBeNull();
    });

    it('compact: expanding the player closes the open dock panel', () => {
      stubEnv(true);
      useGalaxyMapStore.setState({ dockPanel: 'filters', musicExpanded: false });
      s().setMusicExpanded(true);
      expect(s().dockPanel).toBeNull();
      expect(s().musicExpanded).toBe(true);
    });

    it('compact: opening a dock panel collapses the player', () => {
      stubEnv(true);
      useGalaxyMapStore.setState({ dockPanel: null, musicExpanded: true });
      s().toggleDockPanel('view');
      expect(s().dockPanel).toBe('view');
      expect(s().musicExpanded).toBe(false);
    });

    it('compact: opening a dock panel persists the collapsed flag', () => {
      const storage = stubEnv(true);
      useGalaxyMapStore.setState({ dockPanel: null, musicExpanded: true });
      s().toggleDockPanel('view');
      expect(storage.getItem(MUSIC_COLLAPSED_KEY)).toBe('1');
    });

    it('compact: closing a dock panel leaves the player state unchanged', () => {
      stubEnv(true);
      useGalaxyMapStore.setState({ dockPanel: 'view', musicExpanded: false });
      s().toggleDockPanel('view');
      expect(s().dockPanel).toBeNull();
      expect(s().musicExpanded).toBe(false);
    });

    it('compact: collapsing the player leaves an open dock panel open', () => {
      stubEnv(true);
      useGalaxyMapStore.setState({ dockPanel: 'filters', musicExpanded: true });
      s().setMusicExpanded(false);
      expect(s().dockPanel).toBe('filters');
    });

    it('not compact: player and dock panel do not affect each other', () => {
      stubEnv(false);
      useGalaxyMapStore.setState({ dockPanel: 'filters', musicExpanded: false });
      s().setMusicExpanded(true);
      expect(s().dockPanel).toBe('filters');
      expect(s().musicExpanded).toBe(true);
      s().toggleDockPanel('view');
      expect(s().dockPanel).toBe('view');
      expect(s().musicExpanded).toBe(true);
    });
  });
});
