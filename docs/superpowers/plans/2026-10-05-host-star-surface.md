# Superficie e animazione della stella nella System View (issue #16) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stella ospite con granulazione animata, macchie, limb darkening e
corona pulsante, coerente con realismo e movimento ridotto.

**Architecture:** logica pura in `lib/hostStarStyle.ts` (look per
impostazioni, seme per host) → shader della superficie e della corona, con
il rumore condiviso coi pianeti in `shaders/noise.glsl` → componente
`HostStar` che sostituisce la mesh piatta in `SystemScene`.

**Tech Stack:** React 19, @react-three/fiber, three, GLSL (`?raw`), Vitest,
Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-host-star-surface-design.md`

**Branch:** `feat/host-star-surface`

## Global Constraints

- Valori della tabella `hostStarLook` (spec §2), copiati verbatim nel Task 1.
- `STAR_COLOR_GAMMA = 2.5` vive in `lib/starColor.ts`; `StarCloud.tsx` lo importa.
- Costanti estetiche, ciascuna con commento "scelta estetica, non dato" e
  unità: `u = 0.6` (limb darkening, adimensionale), `CORONA_SCALE = 2.5`
  (multipli del raggio), `CORONA_PERIOD_S = 6` (s).
- `uTime` in secondi reali, indipendente da `timeScaleDaysPerSecond`; nessuna
  rotazione.
- Corona: blending additivo, `depthWrite: false`, `depthTest: true`, `raycast`
  disattivato.
- Nessuna dipendenza nuova, nessuna stringa UI nuova, nessun valore
  astronomico nuovo.

## Review Focus

1. **Realismo cambiato mentre si è nella System View** → l'aspetto cambia
   subito, senza uscire dalla vista (test in Task 2, via bridge).
2. **Tempo della System View in pausa** (`time-pause`) → la stella continua ad
   animarsi (test in Task 2).
3. **Uscita e rientro nella System View** → nessun errore, materiali ricreati,
   animazione di nuovo attiva (test in Task 2).
4. **Pianeta davanti alla stella** → resta visibile, la corona non lo copre
   (depthTest attivo; verifica del reviewer sul materiale: un e2e sulla
   posizione orbitale non è affidabile).
5. **Host senza Teff** → stella bianca, nessun NaN nello shader:
   `teffToColor(null)` restituisce già bianco e le fixture hanno solo host con
   Teff, quindi basta un unit test su `teffToColor(null)` se non esiste già
   (Task 1).

---

### Task 1: look della stella, seme per host, costante di gamma

**Files:**
- Create: `app/src/lib/hostStarStyle.ts`
- Modify: `app/src/lib/starColor.ts`, `app/src/scene/StarCloud.tsx`
- Test: `app/tests/unit/hostStarStyle.test.ts` (più `teffToColor(null)` se
  nessun test esistente lo copre)

**Interfaces:**
- Produces:
  - `export const STAR_COLOR_GAMMA = 2.5;` in `lib/starColor.ts`
  - `export interface HostStarLook { colorGamma: number; spots: number; coronaIntensity: number; pulseAmplitude: number; animate: boolean }`
  - `export function hostStarLook(realism: boolean, reducedMotion: boolean): HostStarLook`
  - `export function hostSeed(hostname: string): number` (in `[0, 1)`)

- [ ] **Step 1: test red** — `hostStarStyle.test.ts`:
  - `hostStarLook(false, false)` → `{ colorGamma: 2.5, spots: 1, coronaIntensity: 1, pulseAmplitude: 0.1, animate: true }`
  - `hostStarLook(true, false)` → `{ colorGamma: 1, spots: 0, coronaIntensity: 0.5, pulseAmplitude: 0, animate: true }`
  - `hostStarLook(false, true)` → `{ colorGamma: 2.5, spots: 1, coronaIntensity: 1, pulseAmplitude: 0, animate: false }`
  - `hostStarLook(true, true)` → `{ colorGamma: 1, spots: 0, coronaIntensity: 0.5, pulseAmplitude: 0, animate: false }`
  - `hostSeed('TRAPPIST-1') === hostSeed('TRAPPIST-1')`; valore in `[0, 1)`;
    `hostSeed('TRAPPIST-1') !== hostSeed('Kepler-90')`; `hostSeed('')` in `[0, 1)`.
  - Se manca: `teffToColor(null) === 0xffffff`.
- [ ] **Step 2:** `cd app && npx vitest run tests/unit/hostStarStyle.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3:** spostare `STAR_COLOR_GAMMA` in `lib/starColor.ts` (StarCloud lo
  importa, valore invariato); implementare `hostStarLook` e `hostSeed` (hash
  di stringa deterministico, es. FNV-1a 32 bit diviso per 2³²).
- [ ] **Step 4:** stesso comando → PASS; gate veloce verde.
- [ ] **Step 5:** commit `feat(lib): add host star look and seed helpers`.

### Task 2: shader della stella e della corona, componente `HostStar`

**Files:**
- Create: `app/src/shaders/noise.glsl`, `app/src/shaders/host-star.vert`,
  `app/src/shaders/host-star.frag`, `app/src/shaders/host-corona.vert`,
  `app/src/shaders/host-corona.frag`, `app/src/scene/HostStar.tsx`,
  `app/tests/e2e/hostStar.spec.ts`
- Modify: `app/src/shaders/planet.frag` (rimuovere `hash`/`noise`/`fbm`,
  ricevuti da `noise.glsl`), `app/src/scene/SystemScene.tsx` (concatenazione
  `noiseGlsl + planetFrag` in `planetMaterial`, ~righe 183-200; sostituzione
  della mesh della stella, ~righe 351-354)

**Interfaces:**
- Consumes: `hostStarLook`, `hostSeed`, `STAR_COLOR_GAMMA` (Task 1);
  `teffToColor` (`lib/starColor.ts`); `prefersReducedMotion` (`lib/motion.ts`);
  `useSettingsStore` (`state/settings.ts`).
- Produces: `export function HostStar(props: { radius: number; teffK: number | null; hostname: string }): JSX.Element`;
  con `?pdb=1`, `globalThis.__hostStar = { time: number; look: HostStarLook }`
  aggiornato a ogni frame (stesso pattern di `__system` in `SystemScene`).

- [ ] **Step 1: test red** — `hostStar.spec.ts` (System View di TRAPPIST-1,
  come `enterTrappist` in `a11y.spec.ts`, con `/?pdb=1`; helper che legge una
  griglia di pixel dal canvas della System View: la camera iniziale guarda
  l'origine, quindi il centro del canvas è sul disco della stella):
  - `the star surface is textured`: deviazione standard della luminanza su una
    griglia 5×5 dentro il disco > 4 (scala 0–255);
  - `the star surface animates in real time`: due letture a 1 s di distanza
    differiscono; `__hostStar.time` cresce;
  - `the star keeps animating while System View time is paused` (Review
    Focus 2): click `time-pause`, poi lo stesso controllo;
  - `reduced motion freezes the star`: `page.emulateMedia({ reducedMotion: 'reduce' })`
    prima del `goto`; due letture a 1 s identiche; `__hostStar.look.animate === false`;
  - `the corona brightens the space around the disc`: luminanza di un punto
    appena fuori dal disco > luminanza di un angolo del canvas lontano da
    stella e pianeti;
  - `realism applies live in System View` (Review Focus 1): aprire Opzioni
    dalla dock, attivare realismo → `__hostStar.look.spots === 0` e
    `__hostStar.look.pulseAmplitude === 0` senza ricaricare;
  - `re-entering System View works` (Review Focus 3): uscire dalla System View
    e rientrare → `__hostStar.time` riparte e cresce;
  - in tutti: nessun messaggio `error` in console (errori GLSL di three).
  Raggio del disco in pixel: misurato sull'immagine o ricavato da `__system`;
  il tester sceglie il metodo più stabile e lo documenta nel report.
- [ ] **Step 2:** `npm run build && npx playwright test tests/e2e/hostStar.spec.ts` → FAIL
  (bridge `__hostStar` assente, superficie uniforme).
- [ ] **Step 3: `noise.glsl`** — spostare `hash`, `noise`, `fbm` da
  `planet.frag` senza modificarli; `SystemScene` passa `noiseGlsl + planetFrag`
  a `planetMaterial`.
- [ ] **Step 4: shader** — `host-star.*` e `host-corona.*` come spec §3–§4
  (stella: `uTime`, `uColor`, `uColorGamma`, `uSpots`, `uSeed`; corona:
  `uTime`, `uColor`, `uIntensity`, `uPulse`), costanti dei Global Constraints.
- [ ] **Step 5: `HostStar`** — sfera `sphereGeometry(radius, 64, 32)` + quad
  `planeGeometry` di lato `radius · 2 · CORONA_SCALE` orientato alla camera in
  `useFrame`; materiali in `useMemo`, `dispose` allo smontaggio; in `useFrame`
  legge `useSettingsStore.getState().realism` e `prefersReducedMotion()`,
  aggiorna le uniform, avanza `uTime` del delta solo se `animate`; bridge
  `__hostStar` con `?pdb=1`.
- [ ] **Step 6: `SystemScene`** — sostituire la `<mesh>` della stella con
  `<HostStar radius={starRadius} teffK={host.st_teff} hostname={host.hostname} />`.
- [ ] **Step 7:** `npm run build && npx playwright test tests/e2e/hostStar.spec.ts tests/e2e/system.spec.ts tests/e2e/orbit.spec.ts`
  → PASS; gate completo verde.
- [ ] **Step 8:** commit `feat(render): animate the host star surface and corona`.

A fine issue: documenter aggiorna `docs/STATE.md` (sezione issue #16, esito
AC1–AC5, costanti estetiche) e `README.md` se elenca le feature della System
View; committer `docs(state): record host star surface for issue #16`.
