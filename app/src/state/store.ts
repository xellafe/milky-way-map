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
 * Current selection: a star of the cloud (by SoA index). Hosts with no
 * catalog counterpart (e.g. TRAPPIST-1, SPEC §5.3) open the System View
 * straight from search instead (#23).
 */
export type Selection = { kind: 'star'; index: number } | null;
export type CardMode = 'base' | 'advanced';

/** Persisted flag set while the star card is in Advanced mode (#23). */
export const CARD_ADVANCED_KEY = 'galaxy-map-card-advanced';

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
  selectedPlanetType: PlanetType | null;
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
  /** Star card detail level (#23); initialised from the persisted flag. */
  cardMode: CardMode;
  setCardMode: (mode: CardMode) => void;
  /** Welcome dialog (#12) open; initialised from the persisted dismissal flag. */
  welcomeOpen: boolean;
  /** Opens or closes the welcome dialog (#12). */
  setWelcomeOpen: (open: boolean) => void;
  /** Music player expanded (#13); initialised from the persisted collapsed flag. */
  musicExpanded: boolean;
  setMusicExpanded: (expanded: boolean) => void;
  /** Bumped by every star selection: remounts the overlay, restarting its opening sequence. */
  selectionEpoch: number;

  selectStar: (index: number | null) => void;
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
  selectPlanet: (planet: { name: string; type: PlanetType } | null) => void;
  toggleNames: () => void;
  toggleConstellations: () => void;
  toggleHabitableZone: () => void;
  setTimeScale: (daysPerSecond: number) => void;
  togglePlanetType: (type: PlanetType) => void;
  toggleDockPanel: (id: DockPanelId) => void;
  closeDockPanel: () => void;
}

export const useGalaxyMapStore = create<GalaxyMapState>((set) => ({
  selection: null,
  hoveredStarIndex: null,
  pendingFlyTo: null,
  cameraMode: 'free-fly',
  view: 'galaxy',
  systemHostname: null,
  selectedPlanet: null,
  selectedPlanetType: null,
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
  cardMode: readFlag(CARD_ADVANCED_KEY) ? 'advanced' : 'base',
  setCardMode: (mode) => {
    writeFlag(CARD_ADVANCED_KEY, mode === 'advanced');
    set({ cardMode: mode });
  },
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
  // deselecting releases the lock.
  selectStar: (index) =>
    set((s) =>
      index === null
        ? { selection: null, cameraMode: 'free-fly' }
        : {
            selection: { kind: 'star', index },
            cameraMode: 'orbit',
            selectionEpoch: s.selectionEpoch + 1,
          },
    ),
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
      selectedPlanetType: null,
      dockPanel: null,
      ...(prefersReducedMotion() ? { timeScaleDaysPerSecond: 0 } : {}),
    }),
  // The galaxy selection survives: leaving the system brings back the same
  // star card (and the galaxy camera pose is restored from its holder).
  exitSystemView: () =>
    set({
      view: 'galaxy',
      systemHostname: null,
      selectedPlanet: null,
      selectedPlanetType: null,
      dockPanel: null,
    }),
  selectPlanet: (planet) =>
    set({ selectedPlanet: planet?.name ?? null, selectedPlanetType: planet?.type ?? null }),
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleHabitableZone: () => set((s) => ({ showHabitableZone: !s.showHabitableZone })),
  setTimeScale: (daysPerSecond) => set({ timeScaleDaysPerSecond: daysPerSecond }),
  togglePlanetType: (type) =>
    set((s) => ({
      visiblePlanetTypes: { ...s.visiblePlanetTypes, [type]: !s.visiblePlanetTypes[type] },
      // Hiding the selected planet's class must not leave an invisible selection.
      ...(s.visiblePlanetTypes[type] && s.selectedPlanetType === type
        ? { selectedPlanet: null, selectedPlanetType: null }
        : {}),
    })),
  toggleDockPanel: (id) =>
    set((s) => {
      const opening = s.dockPanel !== id;
      const collapsePlayer = opening && isCompactViewport();
      if (collapsePlayer) writeFlag(MUSIC_COLLAPSED_KEY, true);
      return {
        dockPanel: opening ? id : null,
        musicExpanded: collapsePlayer ? false : s.musicExpanded,
      };
    }),
  closeDockPanel: () => set({ dockPanel: null }),
}));
