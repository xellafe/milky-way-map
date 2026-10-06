# Overhaul della UI desktop (issue #23) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI desktop con nuovo linguaggio visivo e libreria di componenti
condivisa, una sola card (Base/Advanced) per i dati di stelle e pianeti,
System View a due pannelli con camera che segue il pianeta (#10), dock a
pannello unico con schede.

**Architecture:** evoluzione sul posto di `app/src/ui/hud/`; logica pura
(scale, piazzamento della card, schede, inseguimento) in `app/src/lib/` con
unit test; i componenti si verificano con Playwright (bounding box, axe). La
card ancorata (anello + linea di richiamo + `ObjectCard`) è un unico
componente usato per stelle e pianeti; il piazzamento legge l'"area utile" dal
DOM tramite attributi `data-hud`.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4 (`@theme`,
`@layer components`), zustand, react-three-fiber/drei, react-i18next, Vitest,
Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-07-ui-overhaul-design.md`

**Branch:** `feat/ui-overhaul`

## Global Constraints

- Nessuna dipendenza nuova, nessun webfont; versioni pinnate invariate.
- Palette invariata (`hud-accent` #9ec8ff, `hud-bright`, `hud-muted`,
  `hud-text`, `hud-warn`); CSS custom solo in `@layer components`.
- Ogni costante di stile o di scala dichiara unità e natura: **dato**,
  **convenzione** o **scelta estetica (non dato)**; le scelte approvate nei
  mockup sono **scelta umana (#23)**.
- Mai valori inventati: dato assente → gauge vuoto e `n/d`, nessun verdetto.
- Ogni controllo custom tiene sotto l'elemento nativo (checkbox, range,
  select, button) o il ruolo ARIA equivalente; tutto operabile da tastiera.
- Stringhe utente in `en/it/es/fr/de.json` (`app/src/i18n/locales/`).
- Array grandi mai in state/props (AGENTS.md, trappola 1); posizioni per
  frame scritte sul DOM, mai in state React.
- `data-testid` rinominati o rimossi solo aggiornando i test, motivo: #23.
- `prefers-reduced-motion`: niente animazioni (passaggi immediati).

## Review Focus

1. **Stella vicina al bordo con card in Advanced** (≈470 px): la card deve
   restare nell'area utile, anche quando non entra né a destra né a sinistra
   → lato con più spazio (unit `placeCard` in Task 5, e2e in Task 8).
2. **Pianeta selezionato che il filtro per tipo nasconde**: la selezione si
   chiude e la camera smette di seguire (unit store in Task 6).
3. **Pianeta senza semiasse** (`pl_orbsmax` nullo, non disegnato): card non
   ancorata, nessun inseguimento, nessun errore (e2e in Task 7).
4. **localStorage non disponibile** (modalità privata): il toggle
   Base/Advanced funziona per la sessione (unit store in Task 5).
5. **Host non ancorato scelto dalla ricerca** (TRAPPIST-1): si apre la System
   View con badge "Non ancorato", nessun pannello orfano in galassia (e2e in
   Task 5 e Task 8).

---

### Task 1: linguaggio visivo e componenti di base

**Files:**
- Modify: `app/src/index.css` (`@theme`, `.hud-panel` → `.hud-card`)
- Create: `app/src/ui/hud/HudCard.tsx`, `app/src/ui/hud/CloseButton.tsx`,
  `app/src/ui/hud/DataRow.tsx`, `app/src/ui/hud/DataSection.tsx`
- Delete: `app/src/ui/hud/HudPanel.tsx`
- Modify: `app/src/ui/hud/HudButton.tsx`, `app/src/ui/hud/Badge.tsx`, tutti gli
  utilizzatori di `.hud-panel`/`HudPanel` (`FiltersPanel`, `ViewTogglesPanel`,
  `OptionsPanel`, `MusicPlayer`, `SystemOverlay`, `StarPanel`,
  `SelectionOverlay`, `HoverLabel`, `LanguageSelector`, `SearchBox`,
  `WelcomeDialog`, `hud/Dock.tsx`); `StarPanel` usa `DataRow` al posto di `Row`
- Test: `app/tests/e2e/hudRadius.spec.ts` → rinominato `hudStyle.spec.ts`

**Interfaces:**
- Produces:
  - classe CSS `.hud-card`: sfondo `rgb(8 14 28 / 0.72)`, bordo 1 px
    `hud-accent` al 18%, `backdrop-filter: blur(6px)`, staffe agli angoli
    (`::before` alto-sinistra, `::after` basso-destra, 10×10 px, 1,5 px,
    `hud-accent`), angoli vivi (`--radius-hud: 0`; scelta umana #23,
    sostituisce i 3 px di #3);
  - classe `.hud-label`: monospace, 9 px, maiuscolo, `letter-spacing: .12em`,
    `hud-muted`;
  - `HudCard(props: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'aside' | 'nav' | 'header' })`
    → elemento con `.hud-card` e `data-hud-card`;
  - `CloseButton({ onClick, label, testId, hud }: { onClick: () => void; label: string; testId: string; hud?: string })`;
  - `DataRow({ label, value, note, warnNote, testId }: { label: string; value: string | null; note?: string; warnNote?: boolean; testId?: string })`
    → `<div><dt/><dd/></div>`, `value === null` → `t('panel.na')`;
  - `DataSection({ title, children, testId }: { title: string; children: ReactNode; testId?: string })`
    → `<section aria-label={title}>` con titolo `.hud-label` e `<dl>`.

- [ ] **Step 1: test red** — `hudStyle.spec.ts` (Polaris selezionata, Filtri
  aperti): ogni `[data-hud-card]` visibile ha `backdrop-filter` che contiene
  `blur`, `borderTopLeftRadius === '0px'` e `::before` con
  `borderTopWidth === '1.5px'`; nessun elemento con classe `.hud-panel`; il
  ✕ della card ha `aria-label` non vuoto.
- [ ] **Step 2:** `cd app && npx playwright test tests/e2e/hudStyle.spec.ts`
  → FAIL (`data-hud-card` assente).
- [ ] **Step 3:** CSS e componenti come in Interfaces; sostituire
  `.hud-panel`/`HudPanel` ovunque; i ✕ esistenti (`panel-close`,
  `overlay-close`) passano a `CloseButton` con gli stessi testid.
- [ ] **Step 4:** gate veloce + `npx playwright test` → PASS (le e2e
  esistenti restano verdi: cambia solo l'aspetto).
- [ ] **Step 5: commit** `feat(ui): add refined hud card and base components`

---

### Task 2: controlli custom

**Files:**
- Modify: `app/src/ui/hud/HudInputs.tsx` (`HudCheckbox` → `HudSwitch`,
  `HudSlider`, `HudSelect` ridisegnati), `app/src/index.css` (`.hud-range`,
  `.hud-select`, `.hud-switch`)
- Create: `app/src/ui/hud/RangeSlider.tsx`, `app/src/ui/hud/ToggleChip.tsx`,
  `app/src/lib/spectralChip.ts`
- Modify: `FiltersPanel.tsx`, `ViewTogglesPanel.tsx`, `OptionsPanel.tsx`,
  `SystemOverlay.tsx`, `MusicPlayer.tsx`, `WelcomeDialog.tsx` (checkbox
  nativa → `HudSwitch`)
- Test: `app/tests/unit/spectralChip.test.ts`, `app/tests/e2e/filters.spec.ts`,
  `options.spec.ts`, `view.spec.ts`, `system.spec.ts` (selettori aggiornati)

**Interfaces:**
- Produces:
  - `HudSwitch(props: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode })`:
    `<input type="checkbox" role="switch">` con `opacity: 0` steso sopra la
    traccia disegnata (non `sr-only`: deve ricevere i clic); `data-testid` sul
    `<input>`, così `.check()`/`toBeChecked()` continuano a funzionare;
  - `HudSlider`: `input range` con classe `.hud-range` (`appearance: none`,
    traccia 2 px, cursore a barra 2×12 px con bagliore; scelte estetiche);
  - `HudSelect`: `select` con `.hud-select` (`appearance: none`, freccia SVG);
  - `RangeSlider({ id, label, bounds, value, decimals, onChange }: { id: string; label: string; bounds: Range | null; value: Range | null; decimals: number; onChange: (range: Range | null) => void })`:
    due `input range` sovrapposti (`data-testid` `filter-${id}-min-slider`,
    `filter-${id}-max-slider`; `pointer-events` solo sui cursori) e sotto i due
    `input number` esistenti (`filter-${id}-min`, `filter-${id}-max`) resi come
    testo monospace senza bordo, modificabili al focus; ordine lo ≤ hi come
    oggi (`apply` di `FiltersPanel`); `data-testid="filter-${id}"` sul
    contenitore;
  - `ToggleChip({ label, pressed, onToggle, color, testId }: { label: string; pressed: boolean; onToggle: () => void; color?: string; testId: string })`
    → `<button aria-pressed>`; acceso: sfondo `color`, spento: solo bordo;
  - `spectralChipColor(letter: 'O'|'B'|'A'|'F'|'G'|'K'|'M'): string` (`#rrggbb`)
    = `teffToColor` (`lib/starColor.ts`) della Teff rappresentativa
    `SPECTRAL_CHIP_TEFF_K = { O: 35000, B: 15000, A: 8500, F: 6700, G: 5600, K: 4400, M: 3200 }`
    (convenzione: valori tipici di classe; il colore è una scelta estetica).

- [ ] **Step 1: test red** — unit `spectralChip.test.ts`:
  `spectralChipColor('G')` === `'#' + teffToColor(5600).toString(16).padStart(6, '0')`;
  il colore di `'O'` ha componente blu > rossa, quello di `'M'` rossa > blu.
  E2E: in `filters.spec.ts` le classi si spengono con
  `getByTestId('filter-class-M').click()` e si verificano con
  `toHaveAttribute('aria-pressed', 'false')`; nuovo test "range slider":
  `filter-distance-max-slider` `fill('50')` aggiorna `filter-distance-max` a
  `50` e riduce `visible-count`; `toggle-names` ha `role="switch"`.
- [ ] **Step 2:** `npx vitest run tests/unit/spectralChip.test.ts` e
  `npx playwright test tests/e2e/filters.spec.ts` → FAIL.
- [ ] **Step 3:** componenti e CSS come in Interfaces; migrare gli
  utilizzatori (`HudCheckbox` non esiste più); classi spettrali come
  `ToggleChip` (+ "?" per sconosciuta, colore `hud-muted`).
- [ ] **Step 4:** gate veloce + e2e `filters`, `options`, `view`, `system`,
  `welcome`, `music`, `a11y` → PASS.
- [ ] **Step 5: commit** `feat(ui): add custom switch, sliders and chips`

---

### Task 3: dock a pannello unico con schede e pila in basso

**Files:**
- Create: `app/src/lib/tabs.ts`, `app/src/ui/hud/Tabs.tsx`,
  `app/src/ui/TimeBar.tsx` (estratta da `SystemOverlay`),
  `app/src/ui/SystemViewPanel.tsx` (tipi di pianeta, stile orbite, zona
  abitabile, estratti da `SystemOverlay`), `app/src/ui/BottomStack.tsx`
- Modify: `app/src/ui/hud/Dock.tsx`, `app/src/ui/ControlDock.tsx`,
  `FiltersPanel.tsx`, `OptionsPanel.tsx`, `SystemOverlay.tsx`, `App.tsx`,
  locales
- Test: `app/tests/unit/tabs.test.ts`, `app/tests/e2e/dock.spec.ts`,
  `system.spec.ts`

**Interfaces:**
- Consumes: `HudCard`, `HudSwitch`, `ToggleChip`, `HudSelect` (Task 1–2).
- Produces:
  - `nextTabIndex(current: number, key: string, count: number): number | null`
    (`ArrowRight`/`ArrowLeft` ciclici, `Home` → 0, `End` → count−1, altro → null);
  - `Tabs({ items, active, onSelect, label }: { items: { id: DockPanelId; label: string; testId: string }[]; active: DockPanelId; onSelect: (id: DockPanelId) => void; label: string })`
    → `role="tablist"`, tab con `aria-selected`, `aria-controls="dock-panel"`,
    roving `tabIndex`;
  - `BottomStack`: colonna in basso al centro (`data-hud="bottom-stack"`),
    dall'alto: pannello del dock (se aperto), `TimeBar` (solo System View,
    `data-testid="time-scale"` invariato), barra del dock (`data-testid="dock"`).
    Le posizioni si impilano per costruzione: niente offset calcolati;
  - pannello del dock: `HudCard` con `id="dock-panel"`,
    `data-testid="dock-panel"`, `role="tabpanel"`; intestazione = `Tabs` +
    (galassia) contatore `data-testid="visible-count"` + "Reimposta" della
    scheda attiva (`filters-reset`/`options-reset`); i contenuti mantengono i
    testid `filters-panel`, `view-toggles`, `options-panel`;
  - schede: galassia `filters`, `view`, `options`; System View `view`
    (contenuto `SystemViewPanel`, testid `planet-type-*`, `orbit-style`,
    `toggle-hz` invariati) e `options`;
  - piede dei Filtri: `data-testid="visible-total"` = "visibili / totali"
    (totali = `getStarCore()?.count`);
  - `DockPanelId`, `toggleDockPanel`, `closeDockPanel` invariati; il badge
    sopra l'icona sparisce.

- [ ] **Step 1: test red** — unit `tabs.test.ts`:
  `nextTabIndex(2, 'ArrowRight', 3)` → 0; `(0, 'ArrowLeft', 3)` → 2;
  `(1, 'Home', 3)` → 0; `(0, 'End', 3)` → 2; `(1, 'a', 3)` → null.
  E2E `dock.spec.ts`: clic su `filters-toggle` → `dock-panel` visibile con la
  tab dei Filtri `aria-selected="true"`; `ArrowRight` sul tablist seleziona
  Vista e mostra `view-toggles` senza chiudere; Esc chiude e il focus torna a
  `filters-toggle`; `visible-count` sta dentro il bounding box di
  `dock-panel`. `system.spec.ts`: il test "time bar is hidden while a dock
  panel is open" diventa "time bar stays visible below the open dock panel":
  con Opzioni aperto, `time-scale` e `dock-panel` visibili e i loro bounding
  box non si intersecano.
- [ ] **Step 2:** `npx vitest run tests/unit/tabs.test.ts`,
  `npx playwright test tests/e2e/dock.spec.ts tests/e2e/system.spec.ts` → FAIL.
- [ ] **Step 3:** implementare come in Interfaces; `SystemOverlay` perde
  filtri per tipo, stile orbite, HZ e barra del tempo (ora in
  `SystemViewPanel` e `TimeBar`); Opzioni divise in due `DataSection`
  (Camera, Stelle); stringhe nuove (`dock.visibleOf`,
  `options.sectionCamera`, `options.sectionStars`) nelle 5 lingue.
- [ ] **Step 4:** gate veloce + e2e `dock`, `system`, `filters`, `options`,
  `view`, `music`, `a11y` → PASS.
- [ ] **Step 5: commit** `feat(ui): tabbed dock panel and bottom stack`

---

### Task 4: gauge ridisegnati e magnitudine apparente leggibile

**Files:**
- Modify: `app/src/lib/gaugeScale.ts`, `app/src/ui/hud/Gauge.tsx`,
  `app/src/ui/hud/StatTile.tsx`, `app/src/ui/StarStatTiles.tsx`, locales
- Test: `app/tests/unit/gaugeScale.test.ts`, `app/tests/e2e/gaugeScale.spec.ts`

**Interfaces:**
- Produces (in `gaugeScale.ts`):
  - `magnitudeScale = linearScale(20, -1)` (asse invertito: 20 → 0, −1 → 1;
    scelta umana #23);
  - `NAKED_EYE_LIMIT_MAG = 6` (convenzione, cielo buio) e
    `BINOCULAR_LIMIT_MAG = 9` (convenzione approssimata: dipende da strumento
    e cielo); `NAKED_EYE_AT` rimosso;
  - `MAGNITUDE_TICKS`: valori `[20, 10, 9, 6, -1]`, tutti `mark`, etichetta
    `String(v)` (con `−` tipografico per −1);
  - `type VisibilityZone = 'nakedEye' | 'binocular'`;
    `MAGNITUDE_ZONES: readonly { from: number; to: number; kind: VisibilityZone }[]`
    = nakedEye da `pos(6)` a `pos(-1)`, binocular da `pos(9)` a `pos(6)`;
  - `visibilityVerdict(mag: number | null | undefined): 'nakedEye' | 'binocular' | 'telescope' | null`
    (≤ 6, ≤ 9, > 9; null/NaN → null).
- Produces (componenti):
  - `Gauge` nuove props `zones?: readonly { from: number; to: number; label: string; strong: boolean }[]`
    (strong = riquadro evidenziato con etichetta sopra la traccia, altrimenti
    tratto intermedio con etichetta) e `fill?: boolean` (default `true` per
    `track`, ignorato per `spectral`); cursore a barra verticale 2×12 px,
    `data-testid="gauge-marker"` invariato; traccia 2 px;
  - `StatTile` nuova prop `verdict?: string` (riga sotto il valore,
    `data-testid={`${testId}-verdict`}`); tile senza bordo proprio.

- [ ] **Step 1: test red** — unit: `magnitudeScale(20)` → 0,
  `magnitudeScale(-1)` → 1, `magnitudeScale(6)` ≈ 2/3 (1e-9);
  `MAGNITUDE_ZONES` = due zone con gli estremi sopra;
  `visibilityVerdict(6)` → `'nakedEye'`, `(6.01)` → `'binocular'`,
  `(9)` → `'binocular'`, `(9.01)` → `'telescope'`, `(null)` e `(NaN)` → null.
  E2E `gaugeScale.spec.ts`: Polaris (fixture, mag ≈ 1,97) →
  `stat-appmag-verdict` = testo di `gauge.verdictNakedEye` e marcatore a
  destra dell'inizio della zona occhio nudo; Proxima Cen (mag ≈ 11,1) →
  `gauge.verdictTelescope` e marcatore a sinistra della zona binocolo.
- [ ] **Step 2:** `npx vitest run tests/unit/gaugeScale.test.ts`,
  `npx playwright test tests/e2e/gaugeScale.spec.ts` → FAIL.
- [ ] **Step 3:** implementare; `StarStatTiles` passa zone (etichette
  `gauge.nakedEye`, `gauge.binocular`) e verdetto (`gauge.verdictNakedEye`,
  `gauge.verdictBinocular`, `gauge.verdictTelescope`); chiavi nelle 5 lingue;
  `panel.nakedEye` rimossa se non più usata.
- [ ] **Step 4:** gate veloce + e2e `gaugeScale`, `selection`, `overlay` → PASS.
- [ ] **Step 5: commit** `feat(ui): restyle gauges and invert the magnitude axis`

---

### Task 5: card della stella Base/Advanced, `StarPanel` eliminato

**Files:**
- Create: `app/src/ui/hud/CardModeToggle.tsx`, `app/src/ui/hud/ObjectCard.tsx`,
  `app/src/ui/hud/AnchoredCard.tsx`, `app/src/ui/StarDetails.tsx`,
  `app/src/scene/usableArea.ts`
- Modify: `app/src/lib/overlayPlacement.ts`, `app/src/scene/SelectionTracker.tsx`,
  `app/src/ui/SelectionOverlay.tsx`, `app/src/state/store.ts`,
  `app/src/ui/SearchBox.tsx`, `app/src/ui/SystemOverlay.tsx` (badge "Non
  ancorato" provvisorio nell'intestazione), `app/src/App.tsx`,
  `app/src/index.css` (keyframe `card-widen`, `card-fade`), locales
- Delete: `app/src/ui/StarPanel.tsx`
- Test: `app/tests/unit/overlayPlacement.test.ts`, `app/tests/unit/store.test.ts`,
  `app/tests/e2e/overlay.spec.ts`, `selection.spec.ts`, `selectionOpening.spec.ts`,
  `welcome.spec.ts` e le altre e2e che usano `star-panel`

**Interfaces:**
- Consumes: `HudCard`, `CloseButton`, `DataRow`, `DataSection`, `StatTile`
  (Task 1–4); `readFlag`/`writeFlag` (`lib/localFlag.ts`).
- Produces:
  - store: `Selection = { kind: 'star'; index: number } | null` (il caso
    `host` sparisce, con `selectHost`); `cardMode: 'base' | 'advanced'`
    inizializzato da `readFlag(CARD_ADVANCED_KEY)`, `setCardMode(mode)` che
    scrive il flag; `CARD_ADVANCED_KEY = 'galaxy-map-card-advanced'`;
    `selectionOverlayOpen`/`closeSelectionOverlay` rimossi (card chiusa =
    nessuna selezione);
  - `overlayPlacement.ts`:
    `interface Area { left: number; top: number; right: number; bottom: number }` e
    `placeCard(anchorX: number, anchorY: number, cardW: number, cardH: number, area: Area, gap: number, topOffset: number): { side: 'left' | 'right'; shiftY: number }`
    — destra se entra, altrimenti sinistra se entra, altrimenti il lato con
    più spazio; `shiftY` tiene la card tra `area.top` e `area.bottom` (vince
    `top` se la card è più alta dell'area); sostituisce `overlaySide`;
  - `readUsableArea(width: number, height: number): Area` in
    `scene/usableArea.ts`: top = bordo inferiore di `[data-hud=search]` o
    `[data-hud=system-header]`; bottom = minimo dei bordi superiori di
    `[data-hud=bottom-stack]` e `[data-hud=music-player]`; left/right = bordi
    di `[data-hud=side-panel-left]`/`[data-hud=side-panel-right]` se presenti;
    margine 8 px (scelta estetica, l'attuale `CARD_MARGIN_PX`);
  - `ObjectCard({ title, subtitle, onClose, closeTestId, base, advanced, footer, testId, titleTestId }: { title: string; subtitle?: ReactNode; onClose: () => void; closeTestId: string; base: ReactNode; advanced: ReactNode; footer?: ReactNode; testId: string; titleTestId: string })`
    → `section` con `data-mode`, `CardModeToggle` (`card-mode-base`,
    `card-mode-advanced`, `aria-pressed`), colonna sinistra `base`, colonna
    destra `advanced` solo in Advanced (`data-testid="card-advanced"`, scorre
    se manca altezza); larghezza 224 px in Base, 470 px in Advanced (scelte
    umane #23); animazione allargamento 250 ms + dissolvenza della colonna
    200 ms (scelte estetiche), nessuna con reduced motion;
  - `AnchoredCard({ anchorRef, anchored, card }: { anchorRef: (el: HTMLElement | null) => void; anchored: boolean; card: ReactNode })`
    → anello + linea di richiamo (geometria attuale di `SelectionOverlay`) +
    card; `anchored === false` → niente anello né linea (usato in Task 7);
  - `StarDetails.tsx`: `StarExtraRows({ index }: { index: number })`
    (magnitudine assoluta, B–V, età con `star-age`),
    `CatalogSection({ index }: { index: number })`,
    `ArchiveSection({ host }: { host: ExoHost })` (righe `adv-st_*`
    invariate), `ViewSystemButton({ index }: { index: number })`
    (`data-testid="view-system-button"`, testo `panel.viewSystemCount` =
    "{{count}} pianeti noti · Vedi sistema →", disabilitato finché l'host non
    è risolto).
- Testid: `selection-overlay`, `selection-card`, `overlay-close` invariati;
  `panel-title` → titolo della card; `star-advanced` → `card-advanced`;
  `star-panel`, `panel-close`, `planets-badge`, `overlay-planets-badge` e i
  testid di `HostDetails` in galassia rimossi.

- [ ] **Step 1: test red** — unit `overlayPlacement.test.ts` con
  `area = { left: 0, top: 60, right: 1280, bottom: 640 }`, gap 40,
  topOffset −30: ancora a x = 200 con card 224 → `right`; x = 1200 → `left`;
  card 470 ad ancora x = 600 con `area.right = 1000` (nessun lato entra;
  spazio a destra 400, a sinistra 600) → `left`; card alta 300 ad
  ancora y = 620 → il fondo (y − 30 + shiftY + 300) ≤ 640; card alta 700 →
  il top (y − 30 + shiftY) = 60.
  Unit `store.test.ts`: `setCardMode('advanced')` → `cardMode === 'advanced'`
  e `localStorage['galaxy-map-card-advanced'] === '1'`; con
  `localStorage.setItem` che lancia, `setCardMode('advanced')` non lancia e lo
  stato cambia.
  E2E: Polaris dalla ricerca → `selection-card` con `data-mode="base"` e un
  solo `[data-testid=stat-distance]` nel documento (AC1); clic su
  `card-mode-advanced` → `card-advanced` visibile, larghezza della card
  > 400 px, `stat-distance` ancora unico, presenti `star-age`, ID catalogo,
  variabile, multipla (AC3); reload e nuova selezione → `data-mode="advanced"`
  (AC2); con reduced motion, dopo il clic, `getAnimations().length === 0`
  sulla card; Proxima Cen in Base → un clic su `view-system-button` →
  `system-title` = host (AC4); ✕ o Esc → nessuna `selection-card`; TRAPPIST-1
  dalla ricerca → `system-title` "TRAPPIST-1" e `not-anchored-badge` visibile,
  nessuna card in galassia (Review Focus 5); i test "advanced data" di
  `selection.spec.ts` leggono i valori dentro `card-advanced` dopo il clic su
  `card-mode-advanced`.
- [ ] **Step 2:** `npx vitest run tests/unit/overlayPlacement.test.ts tests/unit/store.test.ts`,
  `npx playwright test tests/e2e/overlay.spec.ts tests/e2e/selection.spec.ts` → FAIL.
- [ ] **Step 3:** implementare; `SearchBox` per un host non ancorato chiama
  `enterSystemView(hostname)`; `SelectionTracker` usa `readUsableArea` +
  `placeCard`; Esc deseleziona se non gestito altrove (`defaultPrevented`),
  non dentro un `dialog` e con il dock chiuso; stringhe:
  `panel.viewSystemCount`, `card.base`, `card.advanced`, `card.modeLabel`,
  `card.sectionCatalog`, `card.sectionArchive`; riga del dialog di benvenuto
  su "Vedi sistema" riscritta senza "pannello"; chiavi di `StarPanel` non più
  usate rimosse; 5 lingue.
- [ ] **Step 4:** gate veloce + `npx playwright test` (tutte) → PASS.
- [ ] **Step 5: commit** `feat(ui): single star card with base and advanced modes`

---

### Task 6: la camera segue il pianeta selezionato (#10)

**Files:**
- Create: `app/src/lib/follow.ts`
- Modify: `app/src/state/store.ts`, `app/src/scene/SystemScene.tsx`
  (componente `PlanetFollow`, bridge `__system`), `app/src/ui/SystemOverlay.tsx`
- Test: `app/tests/unit/follow.test.ts`, `app/tests/unit/store.test.ts`,
  `app/tests/e2e/system.spec.ts`

**Interfaces:**
- Produces:
  - `type Vec3 = readonly [number, number, number]`;
    `followStep(camera: Vec3, target: Vec3, next: Vec3): { camera: Vec3; target: Vec3 }`
    → `target = next`, `camera = camera + (next − target)` (offset invariato);
    `approachTarget(start: Vec3, next: Vec3, t: number): Vec3` = interpolazione
    con `easeInOutCubic` (`scene/cameraTween.ts`) da `start` alla posizione
    corrente del pianeta, `t` in [0, 1];
  - store: `selectPlanet(planet: { name: string; type: PlanetType } | null)`;
    stato `selectedPlanet: string | null` e `selectedPlanetType: PlanetType | null`;
    `togglePlanetType(type)` chiude la selezione se nasconde
    `selectedPlanetType`;
  - `PlanetFollow` (in `SystemScene`): alla selezione il target dei controlli
    (`useThree(s => s.controls)`) va verso il pianeta in
    `FOLLOW_APPROACH_S = 1` s (scelta estetica; 0 con reduced motion) con
    `approachTarget`, la camera trasla con lo stesso delta; poi `followStep` a
    ogni frame; alla deselezione smette (la camera resta dov'è); pianeti non
    disegnati → nessun inseguimento;
  - bridge di test `__system`: `cameraTarget: [x, y, z]` e per ogni pianeta
    `position: [x, y, z]` (coordinate di scena).

- [ ] **Step 1: test red** — unit `follow.test.ts`:
  `followStep([10,0,0], [0,0,0], [1,2,3])` → camera `[11,2,3]`, target
  `[1,2,3]`; `approachTarget(a, b, 0)` = a, `approachTarget(a, b, 1)` = b.
  Unit store: con `{ name: 'X b', type: 'rocky' }` selezionato,
  `togglePlanetType('rocky')` → `selectedPlanet === null`;
  `togglePlanetType('giant')` → selezione invariata.
  E2E `system.spec.ts` ("camera follows the selected planet"): TRAPPIST-1,
  clic su `planet-chip` "TRAPPIST-1 b", attesa 1,5 s, due campioni a 0,5 s:
  `cameraTarget` coincide con la `position` del pianeta (distanza < 1e-6) e
  cambia tra i campioni; Esc → `selectedPlanet` nullo e due campioni
  successivi di `cameraTarget` uguali.
- [ ] **Step 2:** `npx vitest run tests/unit/follow.test.ts tests/unit/store.test.ts`,
  `npx playwright test tests/e2e/system.spec.ts -g "follows"` → FAIL.
- [ ] **Step 3:** implementare; Esc nella System View deseleziona il pianeta
  (stesse condizioni del Task 5); aggiornare i chiamanti di `selectPlanet`.
- [ ] **Step 4:** gate veloce + e2e `system`, `orbit`, `hostStar` → PASS.
- [ ] **Step 5: commit** `feat(camera): follow the selected planet in the system view`

---

### Task 7: card del pianeta con gauge

**Files:**
- Modify: `app/src/lib/gaugeScale.ts`, `app/src/ui/SystemOverlay.tsx`
  (`PlanetDetails` rimosso), `app/src/scene/SystemScene.tsx` (`PlanetTracker`),
  locales
- Create: `app/src/ui/PlanetCard.tsx`, `app/src/ui/PlanetStatTiles.tsx`
- Test: `app/tests/unit/gaugeScale.test.ts`, `app/tests/e2e/system.spec.ts`

**Interfaces:**
- Consumes: `AnchoredCard`, `ObjectCard`, `placeCard`, `readUsableArea`,
  `setSelectionAnchor` (Task 5: le due viste non coesistono, l'holder resta
  unico); `StatTile` (Task 4); `selectedPlanet` (Task 6).
- Produces (in `gaugeScale.ts`; scale logaritmiche, intervalli = scelta
  estetica, tacche = dato):
  - `planetRadiusScale = logScale(0.3, 30)` (R⊕), `PLANET_RADIUS_TICKS`:
    Terra 1 `⊕`, Nettuno 3,883 `♆`, Giove 11,209 `♃` (raggi equatoriali,
    convenzione del NASA Exoplanet Archive);
  - `planetMassScale = logScale(0.1, 1e4)` (M⊕), `PLANET_MASS_TICKS`: Terra 1
    `⊕`, Nettuno 17,15 `♆`, Giove 317,83 `♃`;
  - `orbitalPeriodScale = logScale(0.1, 1e5)` (giorni), `PERIOD_TICKS`: 1 e
    365,25 (etichette i18n `gauge.oneDay`, `gauge.oneYear`);
  - `eqTempScale = logScale(50, 3000)` (K), `EQ_TEMP_TICKS`: Terra 255 `⊕`
    (temperatura di equilibrio della Terra con albedo di Bond 0,3: dato).
- Produces (UI):
  - `PlanetCard`: `ObjectCard` con `testId="planet-panel"`,
    `titleTestId="planet-panel-title"`; Base = `PlanetStatTiles` + riga Tipo;
    Advanced (`card-advanced`) = semiasse, eccentricità, inclinazione (+
    "orbita schematica"), metodo, anno, densità, insolazione, provenienza
    massa, composizione (+ nota), senso dell'orbita; testid `adv-*` e
    `adv-composition-note` invariati;
  - `PlanetStatTiles({ planet }: { planet: ExoplanetRecord })`:
    `stat-radius`, `stat-mass`, `stat-period`, `stat-eqt` (valori con
    `formatLimited` dove esiste il flag `*lim`); `stat-eqt-verdict` =
    `system.inHzYes`/`system.inHzNo`, nessun verdetto se `in_hz` è null;
  - `PlanetTracker`: come `SelectionTracker`, proietta la mesh del pianeta
    selezionato sull'anchor e usa `placeCard`;
  - pianeta con `pl_orbsmax` nullo: `AnchoredCard anchored={false}`, card
    accanto a `[data-hud=side-panel-right]` (o al bordo destro), nota
    `system.noOrbitPosition` (`data-testid="planet-no-position"`).

- [ ] **Step 1: test red** — unit: `planetRadiusScale(1)` ≈
  `Math.log10(1 / 0.3) / 2`; `planetMassScale(0.1)` → 0, `(1e4)` → 1;
  `orbitalPeriodScale(365.25)` in (0, 1); `eqTempScale(null)` → null; tacche
  di ogni scala crescenti e in [0, 1]. E2E: TRAPPIST-1 b → `planet-panel`
  visibile in Base con `stat-radius`, `stat-mass`, `stat-period`, `stat-eqt`
  e i valori della fixture; `card-mode-advanced` → `adv-composition-note`
  presente; la card segue il pianeta (transform dell'anchor diverso tra due
  campioni a 0,5 s); pianeta senza `pl_orbsmax` (campo rimosso via
  `page.route` come nel test "legacy") → `planet-no-position` visibile,
  nessun anello, nessun errore in console; i test esistenti su
  `planet-panel`/`adv-*` restano verdi.
- [ ] **Step 2:** `npx vitest run tests/unit/gaugeScale.test.ts`,
  `npx playwright test tests/e2e/system.spec.ts` → FAIL.
- [ ] **Step 3:** implementare; stringhe nuove (`gauge.oneDay`,
  `gauge.oneYear`, `system.noOrbitPosition`, `system.inHzYes`,
  `system.inHzNo`) nelle 5 lingue.
- [ ] **Step 4:** gate veloce + e2e `system`, `a11y` → PASS.
- [ ] **Step 5: commit** `feat(ui): planet card with gauges`

---

### Task 8: layout della System View e verifica finale del layout

**Files:**
- Create: `app/src/ui/SystemStarPanel.tsx`, `app/src/ui/PlanetList.tsx`,
  `app/tests/e2e/layout.spec.ts`
- Modify: `app/src/ui/SystemOverlay.tsx` (intestazione `data-hud="system-header"`,
  badge spostato nel pannello sinistro), `app/src/lib/gaugeScale.ts`
  (`stellarRadiusScale`), locales
- Test: `app/tests/unit/gaugeScale.test.ts`, `app/tests/e2e/layout.spec.ts`,
  `system.spec.ts`, `a11y.spec.ts`

**Interfaces:**
- Consumes: `StarStatTiles`, `StarExtraRows`, `CatalogSection`,
  `ArchiveSection` (Task 4–5), `HudCard`, `DataRow`.
- Produces:
  - `stellarRadiusScale = logScale(0.1, 100)` (R☉, scelta estetica),
    `STELLAR_RADIUS_TICKS`: 0,1, 1, 10, 100;
  - `SystemStarPanel`: `HudCard as="aside"`, `data-hud="side-panel-left"`,
    `data-testid="system-star-panel"`; intestazione con nome host,
    `not-anchored-badge` se `!host.starRef.matched`, classe spettrale; host
    ancorato (`starRef.matchedIndex !== null`) → `StarStatTiles` +
    `StarExtraRows` + `CatalogSection`; non ancorato → tile `stat-teff`,
    `stat-luminosity` (da `10 ** st_lum`), `stat-stellar-radius`; in fondo
    `ArchiveSection`; scorre se serve;
  - `PlanetList`: `HudCard as="aside"`, `data-hud="side-panel-right"`,
    `data-testid="planet-list"`; una riga-pulsante per pianeta visibile
    (`data-testid="planet-chip"`, nome + tipo, `aria-pressed` se selezionato)
    che chiama `selectPlanet({ name: p.pl_name, type: classifyPlanet(p) })`;
    in fondo `system.scaleNote`;
  - pannelli laterali larghi 18 rem, da `top-16` fino sopra
    `[data-hud=music-player]` (scelte estetiche); la barra del tempo resta
    nella `BottomStack`, tra i due.

- [ ] **Step 1: test red** — unit: `stellarRadiusScale(1)` = 0,5. E2E
  `layout.spec.ts`, per 1280×720 e 1920×1080: (galassia) Polaris in Advanced
  con i Filtri aperti, poi la camera ruotata finché Polaris è a < 150 px dal
  bordo destro — i bounding box di ricerca, `bottom-stack` e `music-player`
  non si intersecano e `selection-card` è dentro l'area utile; (System View
  TRAPPIST-1, pianeta b selezionato in Advanced, Opzioni aperte)
  `system-header`, `system-star-panel`, `planet-list`, `time-scale`,
  `dock-panel`, `dock` non si intersecano a coppie e `planet-panel` è dentro
  l'area utile (AC7). `system.spec.ts`: TRAPPIST-1 → `not-anchored-badge`
  dentro `system-star-panel` e `stat-teff` con il valore della fixture;
  Proxima Cen → `stat-distance` nel pannello sinistro (AC5). `a11y.spec.ts`:
  axe senza violazioni serious/critical in galassia (card Advanced, dock
  aperto) e in System View (pannelli, card del pianeta) (AC10).
- [ ] **Step 2:** `npx playwright test tests/e2e/layout.spec.ts tests/e2e/system.spec.ts tests/e2e/a11y.spec.ts`
  → FAIL.
- [ ] **Step 3:** implementare; stringhe nuove (`system.starPanel`,
  `system.planetList`, `panel.stellarRadius`) nelle 5 lingue.
- [ ] **Step 4:** gate completo (`npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run test:e2e`) → PASS.
- [ ] **Step 5: commit** `feat(ui): two-panel system view layout`

---

## Chiusura della issue

- `documenter`: `README.md` (feature visibili: card Base/Advanced, System
  View a due pannelli, camera che segue il pianeta, dock a schede) e
  `STATE.md` (sezione issue #23: decisioni, soglia binocolo come
  convenzione, esito AC); commit `docs(state): …` del `committer`.
- Il controller chiede all'umano push e PR; la PR chiude #10 e fa riferimento
  a #23, che resta aperta per il mobile.
