import { create } from 'zustand';
import { DEFAULT_FILTERS, type DataBounds, type Filters } from '../lib/filterMask';
import { prefersReducedMotion } from '../lib/motion';
import type { PlanetType } from '../lib/planetType';
import { readFlag, writeFlag } from '../lib/localFlag';
import { isCompactViewport } from '../lib/viewport';
import { isWelcomeDismissed } from '../lib/welcome';

export type CameraMode = 'free-fly' | 'orbit';
export type ViewMode = 'galaxy' | 'system';
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DockPanelId = 'filters' | 'view' | 'options';

/**
 * Current selection: a star of the cloud (by SoA index) or an exoplanet host
 * with no catalog counterpart (matched:false, reachable only via search —
 * SPEC §5.3/§10, e.g. TRAPPIST-1).
 */
export type Selection = { kind: 'star'; index: number } | { kind: 'host'; hostname: string } | null;

/** Persisted flag set while the music player is collapsed (#13). */
export const MUSIC_COLLAPSED_KEY = 'galaxy-map-music-collapsed';

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
  /** System View planet type filter (session only, not persisted). */
  visiblePlanetTypes: Record<PlanetType, boolean>;
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
  /** Currently open dock panel, or null if none open (one at a time). */
  dockPanel: DockPanelId | null;
  /**
   * Floating star overlay next to the selection (#3). Reopened by every star
   * selection, even of the same star; closing keeps the selection itself.
   */
  selectionOverlayOpen: boolean;
  /** Welcome dialog (#12) open; initialised from the persisted dismissal flag. */
  welcomeOpen: boolean;
  /** Opens or closes the welcome dialog (#12). */
  setWelcomeOpen: (open: boolean) => void;
  /** Music player expanded (#13); initialised from the persisted collapsed flag. */
  musicExpanded: boolean;
  setMusicExpanded: (expanded: boolean) => void;
  /** Bumped by every star selection: remounts the overlay, so a re-click during
   * its closing flicker reopens it. */
  selectionEpoch: number;

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
  togglePlanetType: (type: PlanetType) => void;
  toggleDockPanel: (id: DockPanelId) => void;
  closeDockPanel: () => void;
  closeSelectionOverlay: () => void;
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
  visiblePlanetTypes: { rocky: true, subNeptune: true, giant: true, unknown: true },
  dataStatus: 'idle',
  dataProgress: 0,
  filters: DEFAULT_FILTERS,
  dataBounds: null,
  visibleCount: null,
  labelsVersion: 0,
  dockPanel: null,
  selectionOverlayOpen: false,
  welcomeOpen: !isWelcomeDismissed(),
  setWelcomeOpen: (open) => set({ welcomeOpen: open }),
  musicExpanded: !readFlag(MUSIC_COLLAPSED_KEY),
  // On compact viewports the expanded player and an open dock panel would
  // overlap, so opening one collapses the other (#13).
  setMusicExpanded: (expanded) => {
    writeFlag(MUSIC_COLLAPSED_KEY, !expanded);
    set((s) => ({
      musicExpanded: expanded,
      dockPanel: expanded && isCompactViewport() ? null : s.dockPanel,
    }));
  },
  selectionEpoch: 0,

  // SPEC §6.3: locking a body switches the camera to orbit around it;
  // deselecting releases the lock. Hosts (matched:false, e.g. TRAPPIST-1)
  // have no position in the cloud, so there is nothing to orbit.
  selectStar: (index) =>
    set((s) =>
      index === null
        ? { selection: null, cameraMode: 'free-fly' }
        : {
            selection: { kind: 'star', index },
            cameraMode: 'orbit',
            selectionOverlayOpen: true,
            selectionEpoch: s.selectionEpoch + 1,
          },
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
      dockPanel: null,
      ...(prefersReducedMotion() ? { timeScaleDaysPerSecond: 0 } : {}),
    }),
  // The galaxy selection survives: leaving the system brings back the same
  // star panel (and the galaxy camera pose is restored from its holder).
  exitSystemView: () =>
    set({ view: 'galaxy', systemHostname: null, selectedPlanet: null, dockPanel: null }),
  selectPlanet: (planetName) => set({ selectedPlanet: planetName }),
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleHabitableZone: () => set((s) => ({ showHabitableZone: !s.showHabitableZone })),
  setTimeScale: (daysPerSecond) => set({ timeScaleDaysPerSecond: daysPerSecond }),
  togglePlanetType: (type) =>
    set((s) => ({
      visiblePlanetTypes: { ...s.visiblePlanetTypes, [type]: !s.visiblePlanetTypes[type] },
    })),
  toggleDockPanel: (id) =>
    set((s) => {
      const opening = s.dockPanel !== id;
      return {
        dockPanel: opening ? id : null,
        musicExpanded: opening && isCompactViewport() ? false : s.musicExpanded,
      };
    }),
  closeDockPanel: () => set({ dockPanel: null }),
  closeSelectionOverlay: () => set({ selectionOverlayOpen: false }),
}));
