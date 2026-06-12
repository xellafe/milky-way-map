import { create } from 'zustand';
import { DEFAULT_FILTERS, type DataBounds, type Filters } from '../lib/filterMask';
import { prefersReducedMotion } from '../lib/motion';

export type CameraMode = 'free-fly' | 'orbit';
export type ViewMode = 'galaxy' | 'system';
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Current selection: a star of the cloud (by SoA index) or an exoplanet host
 * with no catalog counterpart (matched:false, reachable only via search —
 * SPEC §5.3/§10, e.g. TRAPPIST-1).
 */
export type Selection = { kind: 'star'; index: number } | { kind: 'host'; hostname: string } | null;

/** Default System View time scale: 1 real second = 2 simulated days (SPEC §13). */
export const DEFAULT_TIME_SCALE_DAYS_PER_SECOND = 2;
export const TIME_SCALE_MIN_DAYS_PER_SECOND = 0.1;
export const TIME_SCALE_MAX_DAYS_PER_SECOND = 365;

export interface GalaxyMapState {
  selection: Selection;
  /** Star index under the cursor (GPU picking), null when none. */
  hoveredStarIndex: number | null;
  /** One-shot camera fly-to request in world ly; consumed by the scene. */
  pendingFlyTo: [number, number, number] | null;
  cameraMode: CameraMode;
  view: ViewMode;
  /** Host of the currently open System View (SPEC §6.7); null in galaxy view. */
  systemHostname: string | null;
  /** Planet selected in the System View (pl_name), for the details panel. */
  selectedPlanet: string | null;
  showNames: boolean;
  showConstellations: boolean;
  showHabitableZone: boolean;
  /** Simulated days per real second; 0 = paused. */
  timeScaleDaysPerSecond: number;
  /** Star catalog loading lifecycle (big typed arrays live OUTSIDE the store). */
  dataStatus: DataStatus;
  dataProgress: number;
  /** Runtime filters (SPEC §6.5) — GPU visibility mask, no data reload. */
  filters: Filters;
  /** Real data min/max for the filter sliders (SPEC §13); null until details load. */
  dataBounds: DataBounds | null;
  /** Stars passing the current filters; null until the first mask is applied. */
  visibleCount: number | null;
  /**
   * Bumped when the always-on label layout changes (the labels themselves
   * live in labelStore — module holder, never in reactive state).
   */
  labelsVersion: number;

  selectStar: (index: number | null) => void;
  selectHost: (hostname: string) => void;
  setHoveredStar: (index: number | null) => void;
  requestFlyTo: (position: [number, number, number]) => void;
  clearFlyTo: () => void;
  setDataStatus: (status: DataStatus) => void;
  setDataProgress: (fraction: number) => void;
  setFilters: (update: Partial<Filters>) => void;
  resetFilters: () => void;
  setDataBounds: (bounds: DataBounds) => void;
  setVisibleCount: (count: number) => void;
  bumpLabelsVersion: () => void;
  setCameraMode: (mode: CameraMode) => void;
  setView: (view: ViewMode) => void;
  enterSystemView: (hostname: string) => void;
  exitSystemView: () => void;
  selectPlanet: (planetName: string | null) => void;
  toggleNames: () => void;
  toggleConstellations: () => void;
  toggleHabitableZone: () => void;
  setTimeScale: (daysPerSecond: number) => void;
}

export const useGalaxyMapStore = create<GalaxyMapState>((set) => ({
  selection: null,
  hoveredStarIndex: null,
  pendingFlyTo: null,
  cameraMode: 'free-fly',
  view: 'galaxy',
  systemHostname: null,
  selectedPlanet: null,
  showNames: false,
  showConstellations: false,
  showHabitableZone: false,
  timeScaleDaysPerSecond: DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  dataStatus: 'idle',
  dataProgress: 0,
  filters: DEFAULT_FILTERS,
  dataBounds: null,
  visibleCount: null,
  labelsVersion: 0,

  // SPEC §6.3: locking a body switches the camera to orbit around it;
  // deselecting releases the lock. Hosts (matched:false, e.g. TRAPPIST-1)
  // have no position in the cloud, so there is nothing to orbit.
  selectStar: (index) =>
    set(
      index === null
        ? { selection: null, cameraMode: 'free-fly' }
        : { selection: { kind: 'star', index }, cameraMode: 'orbit' },
    ),
  selectHost: (hostname) => set({ selection: { kind: 'host', hostname }, cameraMode: 'free-fly' }),
  setHoveredStar: (index) => set({ hoveredStarIndex: index }),
  requestFlyTo: (position) => set({ pendingFlyTo: position }),
  clearFlyTo: () => set({ pendingFlyTo: null }),
  setDataStatus: (status) => set({ dataStatus: status }),
  setDataProgress: (fraction) => set({ dataProgress: fraction }),
  setFilters: (update) => set((s) => ({ filters: { ...s.filters, ...update } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setDataBounds: (bounds) => set({ dataBounds: bounds }),
  setVisibleCount: (count) => set({ visibleCount: count }),
  bumpLabelsVersion: () => set((s) => ({ labelsVersion: s.labelsVersion + 1 })),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setView: (view) => set({ view }),
  // Under prefers-reduced-motion the orbital animation starts PAUSED (M8
  // decision): the motion is informative content, but continuous motion can
  // disturb users who asked for less of it — they press play to animate.
  enterSystemView: (hostname) =>
    set({
      view: 'system',
      systemHostname: hostname,
      selectedPlanet: null,
      ...(prefersReducedMotion() ? { timeScaleDaysPerSecond: 0 } : {}),
    }),
  // The galaxy selection survives: leaving the system brings back the same
  // star panel (and the galaxy camera pose is restored from its holder).
  exitSystemView: () => set({ view: 'galaxy', systemHostname: null, selectedPlanet: null }),
  selectPlanet: (planetName) => set({ selectedPlanet: planetName }),
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleHabitableZone: () => set((s) => ({ showHabitableZone: !s.showHabitableZone })),
  setTimeScale: (daysPerSecond) => set({ timeScaleDaysPerSecond: daysPerSecond }),
}));
