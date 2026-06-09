import { create } from 'zustand';

export type CameraMode = 'free-fly' | 'orbit';
export type ViewMode = 'galaxy' | 'system';
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Default System View time scale: 1 real second = 2 simulated days (SPEC §13). */
export const DEFAULT_TIME_SCALE_DAYS_PER_SECOND = 2;
export const TIME_SCALE_MIN_DAYS_PER_SECOND = 0.1;
export const TIME_SCALE_MAX_DAYS_PER_SECOND = 365;

export interface GalaxyMapState {
  /** Index into the star SoA buffers; null = nothing selected. */
  selectedStarIndex: number | null;
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
  // Runtime filters (SPEC §6.5) are added in M4.

  selectStar: (index: number | null) => void;
  setDataStatus: (status: DataStatus) => void;
  setDataProgress: (fraction: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setView: (view: ViewMode) => void;
  toggleNames: () => void;
  toggleConstellations: () => void;
  toggleHabitableZone: () => void;
  setTimeScale: (daysPerSecond: number) => void;
}

export const useGalaxyMapStore = create<GalaxyMapState>((set) => ({
  selectedStarIndex: null,
  cameraMode: 'free-fly',
  view: 'galaxy',
  showNames: false,
  showConstellations: false,
  showHabitableZone: false,
  timeScaleDaysPerSecond: DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  dataStatus: 'idle',
  dataProgress: 0,

  selectStar: (index) => set({ selectedStarIndex: index }),
  setDataStatus: (status) => set({ dataStatus: status }),
  setDataProgress: (fraction) => set({ dataProgress: fraction }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setView: (view) => set({ view }),
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleHabitableZone: () => set((s) => ({ showHabitableZone: !s.showHabitableZone })),
  setTimeScale: (daysPerSecond) => set({ timeScaleDaysPerSecond: daysPerSecond }),
}));
