# Superficie e animazione della stella nella System View (issue #16) — design

## Obiettivo

Nella System View la stella ospite smette di essere una sfera piatta: ha una
superficie procedurale animata (granulazione, macchie, bordo più scuro) e una
corona che pulsa piano, nel colore della sua temperatura.

## Stato attuale

- `app/src/scene/SystemScene.tsx`: la stella è `<mesh>` con
  `sphereGeometry(starRadius, 32, 16)` e `meshBasicMaterial` del colore
  `teffToColor(host.st_teff)` (`lib/starColor.ts`; Teff assente → bianco).
  Raggio presentazionale: `max(st_rad · SUN_RADIUS_AU, maxA · 0.045)`.
- Nessun post-processing nella System View (il bloom c'è solo in galassia).
- `shaders/planet.frag` definisce `hash`, `noise`, `fbm` per le superfici dei
  pianeti.
- Galassia (`StarCloud.tsx`): `STAR_COLOR_GAMMA = 2.5` (saturazione dei colori
  pastello); realismo → gamma 1, niente luccichio né nucleo/corona;
  `prefers-reduced-motion` → niente luccichio.
- I click sui pianeti usano gli eventi R3F; `onPointerMissed` sul Canvas
  deseleziona.

## Decisioni (con l'umano)

- **Aspetto:** superficie solare procedurale animata (granulazione che evolve,
  macchie, limb darkening) + corona/alone che pulsa, nel colore della Teff.
- **Realismo:** restano granulazione e limb darkening (fenomeni reali); niente
  esagerazione del colore, niente macchie, corona attenuata, nessuna
  pulsazione.
- **Movimento ridotto:** animazione ferma, superficie visibile.
- **Tempo:** l'animazione va in secondi reali, indipendente dallo slider della
  scala temporale (anche a tempo in pausa). Nessuna rotazione: il periodo di
  rotazione non è nei dati.
- **Approccio:** shader sulla sfera esistente + corona come quad rivolto alla
  camera; niente bloom, niente texture-immagine.

## Design

1. **`app/src/shaders/noise.glsl`** — `hash`, `noise`, `fbm` estratti da
   `planet.frag` senza cambiarne il comportamento. `planet.frag` e il nuovo
   shader della stella li ricevono per concatenazione di stringhe (`?raw`),
   prima del proprio codice. I pianeti devono restare identici.
2. **`app/src/lib/hostStarStyle.ts`** —
   `hostStarLook(realism: boolean, reducedMotion: boolean): HostStarLook` con
   `HostStarLook = { colorGamma: number; spots: number; coronaIntensity: number;
   pulseAmplitude: number; animate: boolean }`:

   | Caso | colorGamma | spots | coronaIntensity | pulseAmplitude | animate |
   |---|---|---|---|---|---|
   | default | `STAR_COLOR_GAMMA` (2.5) | 1 | 1 | 0.1 | true |
   | realismo | 1 | 0 | 0.5 | 0 | true |
   | default + movimento ridotto | 2.5 | 1 | 1 | 0 | false |
   | realismo + movimento ridotto | 1 | 0 | 0.5 | 0 | false |

   `STAR_COLOR_GAMMA` si sposta da `scene/StarCloud.tsx` a `lib/starColor.ts`
   (StarCloud lo importa da lì), così `lib/` non dipende da `scene/`.
   Inoltre `hostSeed(hostname: string): number` in `[0, 1)`, deterministica
   (hash della stringa), per posizionare le macchie.
3. **`app/src/shaders/host-star.vert` / `host-star.frag`** — sulla sfera:
   - granulazione: fbm 3D in coordinate oggetto della sfera unitaria, con una
     terza dimensione che scorre con `uTime` (velocità costante, scelta
     estetica);
   - macchie: rumore a bassa frequenza spostato da `uSeed`, soglia →
     scurimento, moltiplicato per `uSpots`;
   - limb darkening: `I = 1 − u·(1 − μ)`, `μ = dot(normal, viewDir)`,
     `u = 0.6` (commento: "ispirato al Sole, non è il coefficiente della
     stella; scelta estetica");
   - colore: `pow(uColor, vec3(uColorGamma))` × intensità.
   Uniform: `uTime` (s), `uColor`, `uColorGamma`, `uSpots`, `uSeed`.
4. **`app/src/shaders/host-corona.vert` / `host-corona.frag`** — quad
   (`planeGeometry`) di lato `starRadius · 2 · CORONA_SCALE` con
   `CORONA_SCALE = 2.5` (scelta estetica), orientato verso la camera a ogni
   frame; alone radiale che si annulla al bordo del quad, intensità
   `uIntensity · (1 + uPulse · sin(2π · uTime / CORONA_PERIOD_S))` con
   `CORONA_PERIOD_S = 6` (secondi, scelta estetica). Blending additivo,
   `depthWrite: false`, `depthTest: true` (i pianeti davanti la coprono),
   `raycast` disattivato (non intercetta click né `onPointerMissed`).
5. **`app/src/scene/HostStar.tsx`** — `HostStar({ radius, teffK, hostname })`:
   sfera `sphereGeometry(radius, 64, 32)` + corona; materiali creati una volta
   (useMemo) e liberati allo smontaggio. In `useFrame` legge
   `useSettingsStore.getState().realism` e `prefersReducedMotion()`, calcola
   `hostStarLook` e aggiorna le uniform; `uTime` avanza del delta reale solo se
   `animate`. `SystemScene` sostituisce la sua `<mesh>` con
   `<HostStar radius={starRadius} teffK={host.st_teff} hostname={host.hostname} />`.
6. **Test bridge** — con `?pdb=1` il canvas della System View ha già
   `preserveDrawingBuffer`, così l'e2e può leggere i pixel.

Nessuna dipendenza nuova, nessuna stringa UI nuova, SPEC invariata, nessun
valore astronomico nuovo (macchie, granulazione, corona e coefficiente di limb
darkening sono estetici e dichiarati come tali).

## Test

- **Unit** `hostStarLook`: le quattro combinazioni restituiscono i valori della
  tabella. `hostSeed`: stesso nome → stesso valore, in `[0, 1)`, nomi diversi →
  valori diversi ("TRAPPIST-1" vs "Kepler-90").
- **E2e** `hostStar.spec.ts`, System View di TRAPPIST-1 con `?pdb=1`
  (pixel letti dal canvas):
  - **texture:** su una griglia di punti dentro il disco della stella la
    luminosità non è uniforme (deviazione standard sopra una soglia);
  - **animazione:** due letture a 1 s di distanza differiscono;
  - **movimento ridotto** (`page.emulateMedia({ reducedMotion: 'reduce' })`):
    due letture a 1 s di distanza sono identiche;
  - **corona:** un punto appena fuori dal bordo del disco è più luminoso dello
    sfondo lontano dalla stella;
  - **shader:** nessun errore in console durante il caricamento della vista
    (three registra lì gli errori di compilazione GLSL).
- **Regressione:** `system.spec.ts` (click sui pianeti, deselezione) e gli e2e
  dei pianeti restano verdi senza modifiche.

## Acceptance

- AC1: la stella ha granulazione, macchie e bordo più scuro, nel colore della
  Teff; la corona pulsa.
- AC2: l'animazione va in tempo reale, indipendente dalla scala temporale;
  nessuna rotazione.
- AC3: realismo → niente macchie né pulsazione, corona attenuata, gamma 1;
  movimento ridotto → animazione ferma.
- AC4: click e deselezione dei pianeti invariati; pianeti identici a prima.
- AC5: nessun errore di shader; gate completo verde.
