# Messaggio di benvenuto (issue #12) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dialog di benvenuto con descrizione e guida rapida, disattivabile e
riapribile con un pulsante "?".

**Architecture:** flag persistito in `localStorage` (fuori da `Settings`) →
`welcomeOpen` nello store → `<dialog>` nativo aperto con `showModal()` e
pulsante "?" nel gruppo in alto a destra. `CameraControls` ignora i tasti
quando il target sta in un `<dialog>`.

**Tech Stack:** React 19, zustand, react-i18next, Tailwind, Vitest,
Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-03-welcome-message-design.md`

**Branch:** `feat/welcome-message`

## Global Constraints

- Chiave `localStorage`: `galaxy-map-welcome-dismissed`; valore `'1'` =
  disattivato, chiave assente = attivo.
- Il flag **non** entra in `Settings` / `DEFAULT_SETTINGS`.
- Tutte le stringhe UI in `en/it/es/fr/de.json`, chiavi sotto `welcome.*`.
- `data-testid`: `welcome-dialog`, `welcome-dont-show`, `welcome-start`,
  `help-button`.
- CSS custom in `@layer components` di `index.css`.
- Nessuna dipendenza nuova.

## Review Focus

1. **Chiusura con Esc a checkbox spuntata** → la scelta viene salvata come con
   "Start exploring" (test in Task 2).
2. **Viewport basso (1280×600)** → il dialog resta nel viewport e scorre
   all'interno (test in Task 2).
3. **Lingua rilevata dal browser non inglese** → il dialog compare già
   tradotto alla prima apertura (test in Task 2, `locale: 'it-IT'`).
4. **Chiusura dopo la riapertura con "?"** → il focus torna sul pulsante "?"
   (comportamento nativo; test in Task 2).
5. **StrictMode in dev** (effetto eseguito due volte) → `showModal()` su un
   dialog già aperto non deve lanciare: chiamarlo solo se `!dialog.open`
   (Task 2, passo 3).

---

### Task 1: persistenza del flag e stato nello store

**Files:**
- Create: `app/src/lib/welcome.ts`
- Modify: `app/src/state/store.ts`
- Test: `app/tests/unit/welcome.test.ts`, `app/tests/unit/store.test.ts`

**Interfaces:**
- Produces:
  - `export const WELCOME_DISMISSED_KEY = 'galaxy-map-welcome-dismissed';`
  - `export function isWelcomeDismissed(): boolean;`
  - `export function setWelcomeDismissed(dismissed: boolean): void;`
    (`true` → `setItem(KEY, '1')`, `false` → `removeItem(KEY)`)
  - store: `welcomeOpen: boolean` (iniziale `!isWelcomeDismissed()`),
    `setWelcomeOpen: (open: boolean) => void`

- [ ] **Step 1: test red** — `welcome.test.ts` (Vitest senza DOM: stub di
  `localStorage` con `vi.stubGlobal`, `vi.unstubAllGlobals` in `afterEach`):
  - `isWelcomeDismissed()` è `false` con chiave assente;
  - `setWelcomeDismissed(true)` → `getItem(WELCOME_DISMISSED_KEY) === '1'` e
    `isWelcomeDismissed() === true`; poi `setWelcomeDismissed(false)` →
    `getItem` `null` e `isWelcomeDismissed() === false`;
  - `localStorage` i cui metodi lanciano → `isWelcomeDismissed()` è `false` e
    `setWelcomeDismissed(true)` non lancia;
  - `localStorage` assente (`undefined`) → stessi esiti del caso precedente.

  In `store.test.ts`: `setWelcomeOpen(false)` → `welcomeOpen === false`;
  `setWelcomeOpen(true)` → `true`.
- [ ] **Step 2:** `cd app && npx vitest run tests/unit/welcome.test.ts tests/unit/store.test.ts`
  → FAIL (modulo/azione mancanti).
- [ ] **Step 3:** implementare `lib/welcome.ts` (try/catch attorno a ogni
  accesso a `localStorage`, commento che cita SPEC §10) e i due campi dello
  store.
- [ ] **Step 4:** stesso comando → PASS; gate veloce verde.
- [ ] **Step 5:** commit `feat(state): persist the welcome dialog dismissal`.

### Task 2: dialog di benvenuto e pulsante "?"

**Files:**
- Create: `app/src/ui/WelcomeDialog.tsx`, `app/src/ui/HelpButton.tsx`,
  `app/tests/e2e/welcome.spec.ts`
- Modify: `app/src/App.tsx`, `app/src/index.css`,
  `app/src/i18n/locales/{en,it,es,fr,de}.json`, `app/playwright.config.ts`,
  `README.md` (feature visibile)

**Interfaces:**
- Consumes: `isWelcomeDismissed`, `setWelcomeDismissed` (Task 1);
  `useGalaxyMapStore` `welcomeOpen` / `setWelcomeOpen` (Task 1).
- Produces: `export function WelcomeDialog(): JSX.Element`,
  `export function HelpButton(): JSX.Element`.

**Chiavi i18n e testo inglese** (fissato dalla spec; it/es/fr/de tradotti,
titolo italiano: "Benvenuto in Galaxy Map"):

| Chiave | en |
|---|---|
| `welcome.title` | Welcome to Galaxy Map |
| `welcome.description` | A 3D map of the stellar neighborhood around the Sun, built from real data from the HYG and AT-HYG catalogs. Explore the stars and step into systems hosting exoplanets to watch their orbits to scale. |
| `welcome.guideTitle` | Quick guide |
| `welcome.guide.look.action` / `.command` | Look around / orbit the selected star — Drag with the mouse |
| `welcome.guide.move.action` | Move |
| `welcome.guide.move.upDown` / `.roll` | up / down — roll |
| `welcome.guide.zoom.action` / `.command` | Move closer to or away from the selected star — Mouse wheel |
| `welcome.guide.select.action` / `.command` | Select a star and fly to it — Click |
| `welcome.guide.search.action` / `.command` | Find a star by name or catalog ID — Search box |
| `welcome.guide.system.action` / `.command` | See the planetary system — "View system" button in the star panel |
| `welcome.guide.dock.action` / `.command` | Filters, view options and settings — Bottom bar |
| `welcome.dontShowAgain` | Don't show again |
| `welcome.start` | Start exploring |
| `welcome.helpButton` | Show the welcome guide |

La riga "Move" rende: `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>`,
`<kbd>R</kbd>/<kbd>F</kbd> {upDown}`, `<kbd>Q</kbd>/<kbd>E</kbd> {roll}`.

- [ ] **Step 1: config Playwright** — in `use` aggiungere
  `storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'galaxy-map-welcome-dismissed', value: '1' }] }] }`,
  con commento: gli spec esistenti non devono vedere il dialog (issue #12).
- [ ] **Step 2: test red** — `welcome.spec.ts` con
  `test.use({ storageState: { cookies: [], origins: [] } })`, dati da
  `serveFixtureData`:
  - `shows the dialog on first load`: `welcome-dialog` visibile, contiene
    "Welcome to Galaxy Map" e "Quick guide";
  - `Start exploring closes it`: click `welcome-start` → dialog nascosto;
  - `Escape closes it`: `keyboard.press('Escape')` → dialog nascosto;
  - `don't show again persists across reloads`: spunta `welcome-dont-show`,
    click `welcome-start`, `page.reload()` → dialog nascosto dopo che
    `loading-overlay` ha count 0;
  - `Escape also saves the choice` (Review Focus 1): spunta, Esc, reload →
    dialog nascosto;
  - `without the checkbox it shows again`: `welcome-start`, reload → visibile;
  - `help button reopens it with the saved choice`: spunta, chiudi,
    click `help-button` → visibile e `welcome-dont-show` checked; tolta la
    spunta e chiuso, reload → visibile;
  - `focus returns to the help button` (Review Focus 4): riaperto con
    `help-button`, Esc → `help-button` ha il focus;
  - `help button works in the System View`: chiudi, entra in TRAPPIST-1
    (come `enterTrappist` in `a11y.spec.ts`), click `help-button` → visibile;
  - `fits the viewport` (Review Focus 2): a 1280×720 e a 1280×600 il bounding
    box del dialog sta in `[0, width] × [0, height]`;
  - `opens translated` (Review Focus 3): describe con
    `test.use({ locale: 'it-IT' })` → contiene "Benvenuto in Galaxy Map";
  - `axe`: con il dialog aperto, `AxeBuilder.include('[data-testid="welcome-dialog"]')`
    → nessuna violazione serious/critical.
- [ ] **Step 3: `WelcomeDialog`** — `<dialog>` con
  `className="hud-panel rounded-hud …"`, `aria-labelledby` sull'`<h2>` del
  titolo, `data-testid="welcome-dialog"`:
  - effetto su `welcomeOpen`: se true e `!dialog.open` → `showModal()`; se
    false e `dialog.open` → `close()` (Review Focus 5);
  - stato locale `dontShow`, reimpostato a `isWelcomeDismissed()` ogni volta
    che `welcomeOpen` diventa true;
  - `onClose`: `setWelcomeDismissed(dontShow)`, poi `setWelcomeOpen(false)`;
  - footer in `<form method="dialog">`: checkbox con `<label>` e
    `HudButton type="submit"` "Start exploring" (chiusura nativa);
  - guida come `<dl>`; `max-h` entro il viewport con `overflow-y-auto`.
- [ ] **Step 4: CSS** — in `@layer components` di `index.css`: regola per
  `dialog[data-testid="welcome-dialog"]::backdrop` (nero semitrasparente) e
  stile `kbd` del dialog coerente con l'HUD.
- [ ] **Step 5: `HelpButton`** — `HudButton variant="secondary"` "?",
  `aria-label={t('welcome.helpButton')}`, `data-testid="help-button"`,
  `onClick={() => setWelcomeOpen(true)}`.
- [ ] **Step 6: `App.tsx`** — `<HelpButton />` primo figlio del gruppo
  `top-4 right-4`; `<WelcomeDialog />` fuori dallo switch delle viste.
- [ ] **Step 7: i18n** — chiavi della tabella nei 5 file (il test
  `i18n.test.ts` verifica la parità delle chiavi).
- [ ] **Step 8:** `cd app && npm run build && npx playwright test tests/e2e/welcome.spec.ts`
  → PASS; poi gate completo verde (anche i 19 spec esistenti).
- [ ] **Step 9:** documenter aggiorna `README.md` (feature e controlli); commit
  `feat(ui): add the welcome dialog and help button`.

### Task 3: i tasti di movimento non agiscono con il dialog aperto

**Files:**
- Modify: `app/src/scene/CameraControls.tsx` (guardia di `onKeyDown`, ~riga 127)
- Test: `app/tests/e2e/welcome.spec.ts`

**Interfaces:**
- Consumes: `welcome-dialog`, `help-button` (Task 2).

- [ ] **Step 1: test red** — `movement keys do not move the camera while the dialog is open`:
  `goto('/?pdb=1')`, attesa `loading-overlay` count 0, dialog aperto; focus su
  `welcome-start` (`showModal()` mette il focus sulla checkbox, che la guardia
  attuale su `HTMLInputElement` già esclude: senza questo passo il test non
  sarebbe red); legge `__camera` (come in `camera.spec.ts`),
  `keyboard.down('w')`, attesa 500 ms,
  `keyboard.up('w')`, rilegge: `position` identica. Controprova nello stesso
  test: chiuso il dialog, lo stesso tasto sposta la camera.
- [ ] **Step 2:** `npx playwright test tests/e2e/welcome.spec.ts -g "movement keys"`
  → FAIL (la camera si muove sotto il dialog).
- [ ] **Step 3:** in `onKeyDown` uscire anche quando
  `e.target instanceof Element && e.target.closest('dialog')`; aggiornare il
  commento della guardia (cita #12).
- [ ] **Step 4:** stesso comando → PASS; gate completo verde.
- [ ] **Step 5:** commit `fix(camera): ignore movement keys inside dialogs`.

A fine issue: documenter aggiorna `docs/STATE.md` (sezione issue #12,
esito AC1–AC6), committer `docs(state): record welcome dialog for issue #12`.
