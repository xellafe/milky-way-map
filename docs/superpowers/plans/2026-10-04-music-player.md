# Music player in basso a destra (issue #13) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** player HUD in basso a destra con playlist (prev/next), play/pausa,
volume, titolo, riducibile a icona, che convive con dock, pannelli e card di
selezione su desktop e mobile.

**Architecture:** logica pura in `lib/` (flag persistiti, playlist, viewport
compatto) → `musicExpanded` nello store, coordinato con `dockPanel` in
modalità compatta → `MusicPlayer` (evoluzione di `MusicControl`) → ritocchi
di layout a pannelli di destra, barra del tempo e `SelectionTracker`.

**Tech Stack:** React 19, zustand, react-i18next, Tailwind, Vitest,
Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-04-music-player-design.md`

**Branch:** `feat/music-player`

## Global Constraints

- Chiave `localStorage`: `galaxy-map-music-collapsed` (`'1'` = ridotto,
  assente = espanso). Fuori da `Settings`.
- Modalità compatta: `(max-width: 1023px)`.
- `data-testid` esistenti invariati: `music-control` (radice del player),
  `music-toggle`, `music-volume`, `music-audio`. Nuovi: `music-prev`,
  `music-next`, `music-title`, `music-collapse`, `music-expand`.
- `data-hud="music-player"` sulla radice; resta `data-music-zone`.
- Titolo del brano: chiave `music.tracks.soundtrack` = en "Galaxy Map
  soundtrack", it "Colonna sonora di Galaxy Map".
- Volume iniziale 0.4; autoplay al primo gesto invariato.
- Nessuna dipendenza nuova; stringhe UI in en/it/es/fr/de; CSS custom in
  `@layer components`.
- I test e2e che citano la musica in `a11y.spec.ts` e `dock.spec.ts` restano
  validi (usano solo `data-testid` invariati): non si toccano.

## Review Focus

1. **Next/prev a musica in pausa** (anche prima del primo play) → nessun
   errore, il brano torna a 0:00 e resta in pausa (test in Task 2).
2. **Fine del brano** → riparte da capo (next con giro), senza `loop`
   (test in Task 2).
3. **Focus dopo riduci/espandi** → passa al pulsante opposto, non si perde
   sul `body` (test in Task 2).
4. **Ridimensionamento della finestra da desktop a compatto** con player
   espanso e pannello della dock aperto → il player si riduce, nessuna
   sovrapposizione (test in Task 3).
5. **Entrata nella System View in modalità compatta con player espanso** →
   la barra del tempo resta nascosta finché il player è espanso, ricompare
   quando lo si riduce (test in Task 3).

---

### Task 1: flag persistiti, playlist, viewport compatto e stato nello store

**Files:**
- Create: `app/src/lib/localFlag.ts`, `app/src/lib/playlist.ts`,
  `app/src/lib/viewport.ts`
- Modify: `app/src/lib/welcome.ts`, `app/src/state/store.ts`
- Test: `app/tests/unit/localFlag.test.ts`, `app/tests/unit/playlist.test.ts`,
  `app/tests/unit/store.test.ts`

**Interfaces:**
- Produces:
  - `readFlag(key: string): boolean`, `writeFlag(key: string, value: boolean): void`
  - `interface Track { src: string; titleKey: string }`,
    `nextIndex(index: number, length: number): number`,
    `prevIndex(index: number, length: number): number`
  - `COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)'`,
    `isCompactViewport(): boolean`
  - `MUSIC_COLLAPSED_KEY = 'galaxy-map-music-collapsed'` (esportata da
    `store.ts`)
  - store: `musicExpanded: boolean`, `setMusicExpanded(expanded: boolean): void`

- [ ] **Step 1: test red**
  - `localFlag.test.ts` (stub `localStorage` con `vi.stubGlobal`,
    `vi.unstubAllGlobals` in `afterEach`): chiave assente → `false`;
    `writeFlag('k', true)` → `getItem('k') === '1'`, `readFlag('k') === true`;
    `writeFlag('k', false)` → `getItem('k') === null`; metodi che lanciano e
    `localStorage` `undefined` → `readFlag` `false`, `writeFlag` non lancia.
  - `playlist.test.ts`: `nextIndex(0, 1) === 0`, `prevIndex(0, 1) === 0`;
    `nextIndex(0, 3) === 1`, `nextIndex(2, 3) === 0`, `prevIndex(0, 3) === 2`,
    `prevIndex(2, 3) === 1`.
  - `store.test.ts` (stub di `window` con `matchMedia: () => ({ matches })`
    e di `localStorage`):
    - `setMusicExpanded(false)` → `musicExpanded === false` e flag salvato
      (`getItem(MUSIC_COLLAPSED_KEY) === '1'`); `setMusicExpanded(true)` →
      flag rimosso;
    - compatto (`matches: true`): con `dockPanel === 'filters'`,
      `setMusicExpanded(true)` → `dockPanel === null`; con player espanso,
      `toggleDockPanel('view')` → `dockPanel === 'view'` e
      `musicExpanded === false`;
    - non compatto (`matches: false`): le stesse azioni non si influenzano.
  - `welcome.test.ts` resta invariato e deve restare verde.
- [ ] **Step 2:** `cd app && npx vitest run tests/unit/localFlag.test.ts tests/unit/playlist.test.ts tests/unit/store.test.ts`
  → FAIL (moduli/azioni mancanti).
- [ ] **Step 3:** implementare i tre moduli `lib/`; `welcome.ts` delega a
  `readFlag`/`writeFlag` (stessa chiave, stesso comportamento);
  `isCompactViewport` restituisce `false` se `window` o `window.matchMedia`
  mancano; store: `musicExpanded` iniziale `!readFlag(MUSIC_COLLAPSED_KEY)`,
  `setMusicExpanded` e il ramo compatto di `toggleDockPanel` (solo quando
  **apre** un pannello).
- [ ] **Step 4:** stesso comando + `npx vitest run tests/unit/welcome.test.ts`
  → PASS; gate veloce verde.
- [ ] **Step 5:** commit `feat(state): add music player state and playlist helpers`.

### Task 2: `MusicPlayer` con playlist, riduci/espandi e titolo

**Files:**
- Create: `app/src/ui/MusicPlayer.tsx`
- Delete: `app/src/ui/MusicControl.tsx`
- Modify: `app/src/App.tsx`, `app/src/i18n/locales/{en,it,es,fr,de}.json`,
  `README.md` (feature)
- Test: `app/tests/e2e/music.spec.ts`

**Interfaces:**
- Consumes: `nextIndex`, `prevIndex`, `Track` (Task 1); store
  `musicExpanded` / `setMusicExpanded` (Task 1).
- Produces: `export function MusicPlayer(): JSX.Element`, radice con
  `data-hud="music-player"`, `data-testid="music-control"`,
  `data-music-zone`, attributo `data-expanded="true|false"`.

**Chiavi i18n nuove** (en e it fissate; es/fr/de tradotte):

| Chiave | en | it |
|---|---|---|
| `music.prev` | Previous track | Brano precedente |
| `music.next` | Next track | Brano successivo |
| `music.collapse` | Collapse music player | Riduci il player musicale |
| `music.expand` | Expand music player | Espandi il player musicale |
| `music.nowPlaying` | Now playing | In riproduzione |
| `music.tracks.soundtrack` | Galaxy Map soundtrack | Colonna sonora di Galaxy Map |

- [ ] **Step 1: test red** — aggiornare `music.spec.ts` mantenendo il test
  esistente (toggle + volume) e aggiungendo:
  - `prev and next restart the single track and keep playing`: play,
    `currentTime = 5` via `evaluate`, click `music-next` → `currentTime < 1`
    e `paused === false`; idem con `music-prev`;
  - `next while paused keeps it paused` (Review Focus 1): senza mai premere
    play, `music-next` → nessun errore in console, `paused === true`,
    `currentTime < 1`;
  - `the track restarts when it ends` (Review Focus 2): play, `currentTime =
    duration - 0.5` via `evaluate`, poll fino a `currentTime < 1 && !paused`;
    `audio.loop === false`;
  - `collapse and expand do not interrupt playback`: play, click
    `music-collapse` → `music-expand` visibile, `music-toggle` nascosto,
    `paused === false`, focus su `music-expand` (Review Focus 3); click
    `music-expand` → controlli visibili, focus su `music-collapse`,
    `paused === false`;
  - `collapsed state survives a reload`: riduci, `reload()` →
    `music-expand` visibile;
  - `shows the translated track title`: `music-title` contiene "Galaxy Map
    soundtrack"; describe con `test.use({ locale: 'it-IT' })` → "Colonna
    sonora di Galaxy Map";
  - `keyboard reaches every control`: Tab raggiunge `music-prev`,
    `music-toggle`, `music-next`, `music-volume`, `music-collapse`;
  - `axe`: player espanso e ridotto, nessuna violazione serious/critical.
- [ ] **Step 2:** `cd app && npm run build && npx playwright test tests/e2e/music.spec.ts`
  → i test nuovi FAIL (testid mancanti); quello esistente può passare.
- [ ] **Step 3: `MusicPlayer`** — spostare `useMusic` da `MusicControl`
  aggiungendo `trackIndex`, `prev()`, `next()` e `onEnded` (= `next` con
  ripresa automatica). Regola di prev/next: indice nuovo uguale al corrente
  → `currentTime = 0`; altrimenti cambia `src` e, se stava suonando,
  `play()`. Togliere `loop`. `PLAYLIST: Track[]` con un solo elemento
  `{ src: musicUrl, titleKey: 'music.tracks.soundtrack' }`.
  Layout: radice `absolute bottom-4 right-4 z-20`; espanso `w-64` con
  `music-title` (troncato con ellissi, prefisso `music.nowPlaying` per
  screen reader) e riga di controlli; ridotto solo `music-expand` (♪).
  Riduci/espandi via `setMusicExpanded`; dopo il cambio, focus sul pulsante
  opposto. `aria-expanded` + `aria-controls` come da spec §5. L'`<audio>`
  resta montato in entrambi gli stati.
- [ ] **Step 4: `App.tsx`** — `<MusicPlayer />` fuori dallo switch delle
  viste; rimuovere `MusicControl` dal gruppo in alto a destra (restano
  `HelpButton` e `LanguageSelector`); cancellare `MusicControl.tsx`.
- [ ] **Step 5: i18n** — chiavi della tabella nei 5 file.
- [ ] **Step 6:** `npm run build && npx playwright test tests/e2e/music.spec.ts tests/e2e/dock.spec.ts tests/e2e/a11y.spec.ts`
  → PASS; gate veloce verde.
- [ ] **Step 7:** documenter aggiorna `README.md`; commit
  `feat(ui): add the bottom-right music player with playlist controls`.

### Task 3: convivenza del player con dock, pannelli, card e barra del tempo

**Files:**
- Modify: `app/src/ui/MusicPlayer.tsx`, `app/src/ui/StarPanel.tsx` (~riga
  233), `app/src/ui/SystemOverlay.tsx` (~righe 129 e 190),
  `app/src/scene/SelectionTracker.tsx` (~riga 57)
- Test: `app/tests/e2e/music.spec.ts`

**Interfaces:**
- Consumes: `COMPACT_VIEWPORT_QUERY`, `isCompactViewport` (Task 1); store
  `musicExpanded`, `setMusicExpanded`, `dockPanel` (Task 1);
  `[data-hud=music-player]`, `data-expanded` (Task 2).

- [ ] **Step 1: test red** — in `music.spec.ts`, helper
  `intersects(a, b)` sui bounding box (rettangoli che si toccano solo sul
  bordo non contano):
  - `desktop: player sits bottom-right without overlaps` (1280×720):
    `right` del player ≥ 1280−24 e `bottom` ≥ 720−24; nessuna intersezione
    con `dock`; aperto il pannello via `filters-toggle`, nessuna
    intersezione con il pannello; selezionata una stella via ricerca (come
    in `selection.spec.ts`), nessuna intersezione con `star-panel` e con
    `[data-hud=selection-card]`; entrato in TRAPPIST-1, nessuna intersezione
    con la barra del tempo (pannello che contiene `time-pause`);
  - `compact: expanded player sits above the dock` (375×812): nessuna
    intersezione con `dock`; click `filters-toggle` → player ridotto
    (`music-expand` visibile) e nessuna intersezione con il pannello; click
    `music-expand` → pannello della dock chiuso;
  - `compact: resizing down collapses the player when a dock panel is open`
    (Review Focus 4): a 1280×720 player espanso + pannello `filters` aperto,
    `setViewportSize({ width: 375, height: 812 })` → player ridotto, nessuna
    intersezione;
  - `compact System View hides the time bar while the player is expanded`
    (Review Focus 5): 375×812, entra in TRAPPIST-1 (come `enterTrappist` in
    `a11y.spec.ts`), player espanso → `time-pause` non visibile; riduci →
    visibile e nessuna intersezione tra player ridotto e barra;
  - `compact: star panel ends above the expanded player`: 375×812, stella
    selezionata, nessuna intersezione tra `star-panel` e player.
- [ ] **Step 2:** `npm run build && npx playwright test tests/e2e/music.spec.ts -g "desktop:|compact"`
  → FAIL per le sovrapposizioni.
- [ ] **Step 3: `MusicPlayer`** — in modalità compatta (varianti `max-lg:`)
  il player espanso sta a `bottom-20`, `max-w-[calc(100%-2rem)]`; listener
  `matchMedia(COMPACT_VIEWPORT_QUERY)` `change`: entrando in compatto con
  `musicExpanded && dockPanel` → `setMusicExpanded(false)`.
- [ ] **Step 4: pannelli di destra** — `StarPanel` e pannello pianeta di
  `SystemOverlay`: `max-h` che termina sopra il player espanso, due valori
  (sotto `lg` e da `lg`), commento con unità e "scelta estetica, non dato".
- [ ] **Step 5: barra del tempo** — in `SystemOverlay` nascosta anche quando
  `musicExpanded && compatto`; il valore di "compatto" si aggiorna al resize
  (sottoscrizione a `matchMedia`), non solo al primo render.
- [ ] **Step 6: `SelectionTracker`** — limite inferiore della card =
  `Math.min` dei `top` di `[data-hud=dock]` e `[data-hud=music-player]`.
- [ ] **Step 7:** `npx playwright test tests/e2e/music.spec.ts tests/e2e/selection.spec.ts tests/e2e/selectionOpening.spec.ts tests/e2e/system.spec.ts`
  → PASS; gate completo verde.
- [ ] **Step 8:** commit `feat(ui): keep the music player clear of other hud panels`.

A fine issue: documenter aggiorna `docs/STATE.md` (sezione issue #13, esito
AC1–AC6), committer `docs(state): record music player for issue #13`.
