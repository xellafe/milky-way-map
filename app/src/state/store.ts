import { create } from 'zustand';
import { DEFAULT_FILTERS, type DataBounds, type Filters } from '../lib/filterMask';

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
  setCameraMode: (mode: CameraMode) => void;
  setView: (view: ViewMode) => void;
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
  showNames: false,
  showConstellations: false,
  showHabitableZone: false,
  timeScaleDaysPerSecond: DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  dataStatus: 'idle',
  dataProgress: 0,
  filters: DEFAULT_FILTERS,
  dataBounds: null,
  visibleCount: null,

  selectStar: (index) => set({ selection: index === null ? null : { kind: 'star', index } }),
  selectHost: (hostname) => set({ selection: { kind: 'host', hostname } }),
  setHoveredStar: (index) => set({ hoveredStarIndex: index }),
  requestFlyTo: (position) => set({ pendingFlyTo: position }),
  clearFlyTo: () => set({ pendingFlyTo: null }),
  setDataStatus: (status) => set({ dataStatus: status }),
  setDataProgress: (fraction) => set({ dataProgress: fraction }),
  setFilters: (update) => set((s) => ({ filters: { ...s.filters, ...update } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setDataBounds: (bounds) => set({ dataBounds: bounds }),
  setVisibleCount: (count) => set({ visibleCount: count }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setView: (view) => set({ view }),
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleHabitableZone: () => set((s) => ({ showHabitableZone: !s.showHabitableZone })),
  setTimeScale: (daysPerSecond) => set({ timeScaleDaysPerSecond: daysPerSecond }),
}));
