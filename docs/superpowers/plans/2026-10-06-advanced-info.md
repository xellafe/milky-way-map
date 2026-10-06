# Informazioni avanzate su stelle e pianeti (issue #18) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sezioni "Dati avanzati" nel pannello stella (stelle ospiti) e nel
pannello pianeta, con soli dati del catalogo più una composizione indicativa
del pianeta dal modello massa-raggio.

**Architecture:** nuove colonne `pscomppars` nella pipeline esistente →
`exoplanets.json` → normalizzazione al caricamento (campi assenti → `null`)
→ funzioni pure in `lib/` (composizione, verso dell'orbita, valore con
limite) → due `<details>` nei pannelli esistenti.

**Tech Stack:** Python (pipeline, pytest), React 19, TypeScript strict,
react-i18next, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-06-advanced-info-design.md`

**Branch:** `feat/advanced-info`

## Global Constraints

- Colonne nuove esattamente come spec §1 (23 colonne, inclusi i flag `*lim`
  e `st_metratio`, `pl_bmassprov`).
- Flag `lim`: `1` → "<" (limite superiore), `-1` → ">" (limite inferiore),
  `0`/`null` → misura. Valore e flag sempre dalla stessa riga.
- Composizione solo con `pl_bmassprov === 'Mass'`; curve di Zeng et al. 2019
  (PNAS 116, 9723): composizione terrestre (32.5% Fe) e 50% H₂O a 300 K
  (la curva d'acqua più fredda: scelta di presentazione, dichiarata);
  interpolazione log-log; punti copiati dalla tabella pubblicata con l'URL
  della fonte nel commento, mai stimati.
- Verso dell'orbita: ψ (`pl_trueobliq`) prevale su |λ| (`pl_projobliq`);
  `< 90` prograda, `> 90` retrograda, `90`/limite/assente → `null`.
- Unità: metallicità dex; età Gyr; massa stellare M☉; log g cgs; rotazione
  giorni; v sin i km/s; densità g/cm³; irraggiamento S⊕.
- Voci non mostrate: cicli solari, asse e verso di rotazione del pianeta,
  composizione della stella.
- `exoplanets.json` senza i nuovi campi deve funzionare (→ "n/d").
- Stringhe in en/it/es/fr/de; nessuna dipendenza nuova; nessun valore
  inventato; fixture solo rigenerate da dati reali.

## Review Focus

1. **`exoplanets.json` di produzione vecchio (senza i nuovi campi)** → pannelli
   con "n/d", nessun errore (unit test sulla normalizzazione in Task 2; e2e
   con fixture privata dei campi in Task 3).
2. **Valore limite** (`*lim` = ±1) → "<"/">" davanti al numero, mai mostrato
   come misura (unit `limitPrefix` in Task 2; pytest sull'accoppiamento
   valore/flag in Task 1).
3. **Massa minima o stimata** (`Msini`, `M-R relationship`) → composizione
   "n/d", anche se la densità c'è (unit in Task 2).
4. **`st_met` presente ma `st_metratio` assente** → etichetta "Metallicità"
   senza [Fe/H]/[M/H], mai una scala indovinata (Task 3).
5. **Pannello lungo con le sezioni aperte** (1280×720) → il pannello scorre e
   non si sovrappone al music player (bounding box in Task 3).

---

### Task 1: colonne nuove nella pipeline e fixture rigenerate

**Files:**
- Modify: `data-pipeline/fetch_exoplanets.py` (`COLUMNS`, ~29-53),
  `data-pipeline/crossmatch.py` (`PLANET_FIELDS` ~48, `HOST_STAR_FIELDS` ~61,
  `group_hosts` ~184, oggetto host in output ~265-272),
  `data-pipeline/README.md`
- Regenerate: `data-pipeline/fixtures/exoplanets_raw.json`,
  `data-pipeline/fixtures/exoplanets.json` (via `fetch_exoplanets.py` +
  `crossmatch.py` + `make_fixtures.py`)
- Test: `data-pipeline/tests/test_crossmatch.py`, `data-pipeline/tests/test_fixtures.py`

**Interfaces:**
- Produces (in `exoplanets.json`): host → `st_met`, `st_metlim`,
  `st_metratio`, `st_age`, `st_agelim`, `st_mass`, `st_masslim`, `st_logg`,
  `st_logglim`, `st_spectype`, `st_rotp`, `st_rotplim`, `st_vsin`,
  `st_vsinlim`; pianeta → `pl_dens`, `pl_denslim`, `pl_insol`,
  `pl_insollim`, `pl_bmassprov`, `pl_projobliq`, `pl_projobliqlim`,
  `pl_trueobliq`, `pl_trueobliqlim`. Assenti → `null`.

- [ ] **Step 1: test red** (`test_crossmatch.py`):
  - `test_new_host_fields_first_nonnull`: due righe dello stesso host, la
    prima con `st_met=None`, la seconda con `st_met=0.1, st_metlim=0` →
    host `st_met == 0.1`, `st_metlim == 0`.
  - `test_value_and_limit_from_same_row`: riga 1 `st_age=None, st_agelim=1`,
    riga 2 `st_age=5.0, st_agelim=0` → host `st_age == 5.0` e
    `st_agelim == 0` (mai il flag della riga 1).
  - `test_new_planet_fields_passthrough`: `pl_dens`, `pl_bmassprov`,
    `pl_projobliq`, `pl_projobliqlim` copiati; assenti → `None`.
  - `test_fixtures.py`: gli host della fixture hanno tutte le nuove chiavi.
- [ ] **Step 2:** `cd data-pipeline && python -m pytest -q` → FAIL sui test nuovi.
- [ ] **Step 3:** colonne in `COLUMNS`; in `crossmatch.py` i campi stella
  entrano in `HOST_STAR_FIELDS` e nell'output host; per ogni coppia
  valore/flag il "primo non nullo" si decide sul **valore** e il flag si
  copia dalla stessa riga; `st_metratio` va preso dalla stessa riga di
  `st_met`; `st_spectype` segue la regola del primo non nullo.
- [ ] **Step 4:** rigenerare: `python fetch_exoplanets.py` (rete, NASA TAP),
  `python crossmatch.py`, `python make_fixtures.py`; `git diff --stat
  data-pipeline/fixtures` deve toccare solo i file `exoplanets*`; se cambiano
  anche le fixture stellari, ripristinarle e riportarlo.
- [ ] **Step 5:** pytest → PASS; gate veloce dell'app verde (le fixture sono
  usate dagli e2e).
- [ ] **Step 6:** README della pipeline (colonne, convenzione `lim`);
  misurare la dimensione di `data/exoplanets.json` prima/dopo (byte e gzip)
  e riportarla nel report.
- [ ] **Step 7:** commit `feat(pipeline): fetch advanced star and planet columns`.

### Task 2: logica pura e caricamento

**Files:**
- Create: `app/src/lib/planetComposition.ts`, `app/src/lib/orbitSense.ts`,
  `app/src/lib/limitedValue.ts`
- Modify: `app/src/data/exoplanets.ts` (tipi ~8-28, `loadExoplanets` ~39-50),
  `NOTICE.md` (citazione del modello Zeng et al. 2019)
- Test: `app/tests/unit/planetComposition.test.ts`,
  `app/tests/unit/orbitSense.test.ts`, `app/tests/unit/limitedValue.test.ts`,
  `app/tests/unit/exoplanets.test.ts` (o il file unit esistente del loader)

**Interfaces:**
- Consumes: i campi del Task 1.
- Produces:
  - `export type Lim = -1 | 0 | 1 | null`
  - `ExoHost` + `st_met, st_age, st_mass, st_logg, st_rotp, st_vsin: number | null`,
    `st_metlim, st_agelim, st_masslim, st_logglim, st_rotplim, st_vsinlim: Lim`,
    `st_metratio, st_spectype: string | null`
  - `ExoplanetRecord` + `pl_dens, pl_insol, pl_projobliq, pl_trueobliq: number | null`,
    `pl_denslim, pl_insollim, pl_projobliqlim, pl_trueobliqlim: Lim`,
    `pl_bmassprov: string | null`
  - `export function normalizeExoplanets(raw: unknown): ExoplanetsData` (campi
    assenti → `null`; usata da `loadExoplanets`)
  - `export type Composition = 'rocky' | 'water' | 'gaseous'`;
    `export function planetComposition(massEarth: number | null, radiusEarth: number | null, massProv: string | null): Composition | null`;
    `export function rockyRadius(massEarth: number): number`,
    `export function water50Radius(massEarth: number): number` (esportate per i test)
  - `export type OrbitSense = 'prograde' | 'retrograde'`;
    `export function orbitSense(trueDeg: number | null, trueLim: Lim, projDeg: number | null, projLim: Lim): OrbitSense | null`
  - `export function limitPrefix(lim: Lim): '<' | '>' | ''`

- [ ] **Step 1: test red:**
  - composizione (a 5 M⊕): `planetComposition(5, 0.95 * rockyRadius(5), 'Mass') === 'rocky'`;
    `planetComposition(5, (rockyRadius(5) + water50Radius(5)) / 2, 'Mass') === 'water'`;
    `planetComposition(5, 1.1 * water50Radius(5), 'Mass') === 'gaseous'`;
    Nettuno `(17.1, 3.88, 'Mass')` e Giove `(317.8, 11.2, 'Mass')` → `'gaseous'`;
    `'Msini'`, `'M-R relationship'`, `null` → `null`; massa o raggio `null`,
    `0`, negativo, `NaN` → `null`; `rockyRadius` e `water50Radius` crescenti
    in M e `water50Radius(m) > rockyRadius(m)` su 0.5, 1, 5, 20 M⊕.
  - verso: `(10, 0, null, null)` → prograde; `(120, 0, null, null)` → retrograde;
    `(null, null, -150, 0)` → retrograde; `(10, 0, -150, 0)` → prograde (ψ
    prevale); `(90, 0, null, null)` → null; `(10, 1, null, null)` → null;
    `(null, null, null, null)` → null.
  - `limitPrefix(1) === '<'`, `limitPrefix(-1) === '>'`, `0`/`null` → `''`.
  - `normalizeExoplanets` con un host e un pianeta privi dei campi nuovi →
    tutti `null` (Review Focus 1); con i campi presenti → copiati.
- [ ] **Step 2:** `cd app && npx vitest run tests/unit/planetComposition.test.ts tests/unit/orbitSense.test.ts tests/unit/limitedValue.test.ts` (+ loader) → FAIL.
- [ ] **Step 3:** implementare. Tabelle Zeng et al. 2019: scaricarle dalla
  pagina pubblica dei modelli di L. Zeng (Harvard CfA), "Earth-like rocky
  (32.5% Fe + 67.5% MgSiO₃)" e "50% H₂O, 300 K"; copiare nel codice i punti
  tra ~0.1 e ~100 M⊕ con l'URL esatto nel commento; se la fonte non è
  raggiungibile → `BLOCKED` (mai valori a memoria). Interpolazione log-log;
  fuori range estrapolazione dal segmento finale
  (`Deliberate simplification: …`).
- [ ] **Step 4:** test → PASS; gate veloce verde.
- [ ] **Step 5:** `NOTICE.md`: citazione del modello (Zeng et al. 2019, PNAS
  116, 9723; tabelle dal sito dell'autore).
- [ ] **Step 6:** commit `feat(lib): add planet composition and orbit sense helpers`.

### Task 3: sezioni "Dati avanzati" nei pannelli

**Files:**
- Modify: `app/src/ui/StarPanel.tsx` (`StarDetails` ~51-147: riga "Età" ~100
  e sezione per l'host ancorato; `HostDetails` ~149-218), `app/src/ui/SystemOverlay.tsx`
  (`PlanetDetails` ~44-86), `app/src/i18n/locales/{en,it,es,fr,de}.json`,
  `README.md`
- Test: `app/tests/e2e/selection.spec.ts` (pannello stella),
  `app/tests/e2e/system.spec.ts` (pannello pianeta), `app/tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: tipi e funzioni del Task 2.
- Produces: `data-testid` `star-advanced`, `planet-advanced`; righe con
  `data-testid` `adv-<campo>` (es. `adv-st_met`, `adv-pl_dens`,
  `adv-composition`, `adv-orbit-sense`, `adv-mass-prov`).

- [ ] **Step 1: test red** (e2e, golden fixture; valori attesi letti dalla
  fixture nel test, formattati come l'app):
  - TRAPPIST-1 (host non ancorato) e Proxima Cen (ancorato): `star-advanced`
    presente e chiuso; aperto da tastiera (Tab + Invio sul `summary`)
    mostra metallicità, età, massa, log g, tipo spettrale, rotazione,
    v sin i dalla fixture; campi `null` → "n/d"; con `*lim` ±1 il testo
    inizia con "<"/">".
  - Proxima Cen: la riga "Età" del pannello base mostra `st_age` se la
    fixture lo ha, altrimenti resta "n/d" con la nota HYG.
  - Etichetta metallicità: con `st_metratio` "[Fe/H]" o "[M/H]" nel testo;
    senza, solo "Metallicità" (Review Focus 4: se nessun host della fixture
    copre il caso, estrarre l'etichetta in un helper puro di `lib/` e
    coprirlo con un unit test).
  - Pianeta (TRAPPIST-1, System View): `planet-advanced` mostra densità,
    irraggiamento, provenienza massa tradotta, composizione con nota
    "modello approssimato" (valore atteso = `planetComposition` sui dati
    della fixture), verso dell'orbita o "n/d".
  - Review Focus 1: route che serve la fixture privata dei campi nuovi →
    sezioni aperte con solo "n/d", nessun errore in console.
  - Review Focus 5: a 1280×720, con `star-advanced` aperto, il bounding box
    del pannello stella non interseca `[data-hud=music-player]` e il pannello
    è scrollabile.
  - `axe` sulle due sezioni aperte: nessuna violazione serious/critical.
- [ ] **Step 2:** `npm run build && npx playwright test tests/e2e/selection.spec.ts tests/e2e/system.spec.ts tests/e2e/a11y.spec.ts` → FAIL sui test nuovi.
- [ ] **Step 3:** sezioni `<details>` con lo stesso stile di "Altri dati"
  (`StarPanel.tsx` ~102); righe via il componente `Row` esistente; numeri con
  `formatNumber` + `limitPrefix`; nessuna voce per cicli, asse, rotazione del
  pianeta, composizione della stella.
- [ ] **Step 4:** chiavi i18n in 5 lingue (etichette, unità nuove, `rocky`/
  `water`/`gaseous`, `prograde`/`retrograde`, provenienza massa `Mass`/
  `Msini`/`Msin(i)/sin(i)`/`M-R relationship`, nota modello approssimato).
- [ ] **Step 5:** e2e → PASS; gate completo verde.
- [ ] **Step 6:** README (feature del pannello).
- [ ] **Step 7:** commit `feat(ui): show advanced star and planet data`.

A fine issue: documenter aggiorna `docs/STATE.md` (sezione #18: AC1–AC6,
voci non fattibili e perché, curva 300 K come scelta, crescita misurata di
`exoplanets.json`, nota che la produzione mostra "n/d" fino al prossimo
data-refresh); committer `docs(state): record advanced info for issue #18`.
