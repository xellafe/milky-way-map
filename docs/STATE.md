# STATE.md — Stato sviluppo Galaxy Map

> Aggiornare a ogni `[CHECKPOINT]`. È il punto di ripresa dello sviluppo.

## Stato corrente

- **Data ultimo aggiornamento:** 2026-06-10 (+ hotfix OOM dev-mode post-M4)
- **Milestone completate:** **M0** ✅, **M1** ✅, **M2** ✅, **M3** ✅, **M4 — Ricerca & filtri** ✅
- **Milestone corrente:** — (M4 chiusa, fermo al `[CHECKPOINT 3]`)

## 🔥 Hotfix post-M4: OOM del browser in `npm run dev` (RISOLTO)

- **Sintomo**: con i dati completi (2,49M stelle) il dev server congelava la pagina e Chrome andava in "Out of Memory" (~4 GB di heap V8, task sincrono eterno). In produzione/preview tutto sano (90 MB). Latente già da M2 (allora si fermava a ~2,4 GB e sopravviveva); M3/M4 hanno aggiunto consumi e sfondato il limite.
- **Causa radice** (diagnosi: heap monitor CDP + bisect a route bloccate + worktree M2 + loader isolato + `Debugger.pause` campionato): i **Performance Tracks della build dev di React 19** (`logComponentRender` → `addObjectDiffToProperties` → `addValueToProperties`) serializzano i **diff delle props/state dei componenti elemento per elemento**. `stars` (SoA con Float32Array da 7,5M elementi) passava per `useState`/props → React dev enumerava milioni di elementi a ogni commit → minuti di task sincrono e GB di micro-oggetti.
- **Fix architetturale**: i typed array NON passano mai per state/props React. Nuovo `src/data/starCoreStore.ts` (modulo holder per core SoA + BufferGeometry condivisa, stessa regola di `starDetailsStore`); React veicola solo il flip di `dataStatus`. `GalaxyScene`/`StarCloud`/`StarPicking`/`SearchBox`/`StarPanel` leggono dal modulo store, zero props pesanti.
- **Verifica**: dev + dati completi ora **62–69 MB stabili**, load istantaneo; 63 unit + 15 e2e verdi; regression guard `tests/unit/storeHygiene.test.ts` (lo store reattivo non deve contenere TypedArray/array enormi). Strumenti diagnostici riusabili: `app/scripts/measure-memory.mjs` (+ `measure-fps.mjs`).
- **Regola permanente per M5+**: qualsiasi dato per-stella nuovo (label, maschere, posizioni schermo…) va in module holder, MAI nello store zustand né in props/state React.
- **Prossimo passo:** attendere ok umano al `[CHECKPOINT 3]`, poi **M5 — Modalità camera & transizioni**: free-fly + orbit on lock (selezione → orbita attorno al bersaglio, SPEC §6.3), fly-to animato con tween, rispetto di `prefers-reduced-motion`. Il `FlyToHandler` attuale (salto istantaneo) va sostituito con transizioni interpolate; lo store ha già `cameraMode`.

## Cosa esiste (M4, in aggiunta a M0–M3)

- **Filtri runtime §6.5 via maschera GPU**: attributo `aVisible` (Uint8) aggiornato in place da `applyFilterMask` (`starGeometry.ts`) — mai ricaricati i dati; sia `star.vert` sia `star-pick.vert` scartano i punti filtrati (**le stelle nascoste non sono né visibili né pickabili**). `computeFilterMask` puro in `lib/filterMask.ts`: multi-select spettrale O–M+sconosciuto, range distanza/mag.app/mag.ass (NaN nascosto sotto range attivo — documentato), toggle esopianeti/multiple/variabili. Bounds slider da min/max reali (`computeDataBounds`, NaN-safe) calcolati al load dei details. Default: tutto visibile (SPEC §13).
- **FiltersPanel**: collassabile, checkbox + 2 input numerici per range + 3 toggle + reset; **contatore stelle visibili** (dal conteggio reale della maschera, `store.visibleCount`).
- **Ricerca §6.4 completata**: id **Gaia** via bucket on-demand (`idSearch.ts`, bucket `(id>>35)%256`), id **TYC** (`TYC1%256`), tollera prefissi "Gaia DR3"/"TYC"; substring match con ranking (prefix prima) per i nomi; risultati id asincroni keyed-by-query nella SearchBox.
- Test: **62 unit** (maschera con casi NaN/flag/bounds, routing bucket, ranking) + **15 e2e** (conteggi attesi **calcolati dalla fixture** per ogni filtro: classi spettrali esatte, exo=1, range distanza/magnitudini, variabili/multiple; pixel readback prima/dopo; ricerca per HD id → fly-to; stelle filtrate non pickabili).

## Esiti verifica M4 (AC) e note di debug

- AC ✅: ogni filtro produce esattamente l'insieme atteso (conteggi verificati contro la fixture, non solo "di meno"); ricerca → fly-to verificata (HD 8890 → Polaris centrata, hover sul centro la conferma).
- Bug reale trovato dai test: i toggle di classe spettrale costruivano l'array dalla **closure** del componente → click rapidi consecutivi ripartivano da stato stantio e annullavano il toggle precedente. Fix: leggere `getState()` dello store nel handler.
- Flakiness e2e: troppe pagine WebGL parallele in headless affamano main thread/GPU → check di azionabilità Playwright a vuoto. Mitigato: `workers` cappati (4 locali / 2 CI), timeout test 60 s, `expect.poll` sul contatore, poll sul pixel readback. Suite passata 2× consecutive.

## Cosa esiste (M3, in aggiunta a M0–M2)

- **GPU picking** (`StarPicking.tsx` + `star-pick.vert/.frag` GLSL3): secondo `Points` che condivide la stessa geometry, ID stella = `gl_VertexID` codificato RGB 24-bit, render mirato 1×1 via `camera.setViewOffset`, max 1 pick/frame, depth test attivo (vince la stella più vicina), clear bianco = nessuna stella. Click vs drag discriminato (≤5 px). Nessun raycast CPU.
- **Hover label** (`HoverLabel.tsx`): nome proprio o ID primario (SPEC §6.2); stelle non nell'indice classico → Gaia/TYC via Range request 16 B (`catalogIds.ts`, cache).
- **Pannello dettagli** (`StarPanel.tsx`, §6.6): nome, ID catalogo (HD/HIP/Gl + TYC/Gaia), tipo spettrale, classe luminosità **n/d** (non nel contratto dati — mai stimata), distanza, mag app/ass, B–V, luminosità L☉, **Teff stimata da B–V (Ballesteros 2012**, `lib/teff.ts`, etichettata "stima approssimata"), **età sempre n/d in v1** (HYG/AT-HYG non la fornisce — mai fabbricata), variabile/multipla da flag, esopianeti con conteggio pianeti + bottone "Vedi sistema" disabilitato fino a M7. Pannello host **non agganciato** (es. TRAPPIST-1): badge dedicato, dati stella ospite da pscomppars, lista pianeti.
- **Ricerca minima** (`SearchBox.tsx`, completata in M4): prefix su proper/HD/HIP/Gl (+alias Gl↔GJ) dall'indice classico (`namesIndex.ts`, lazy 16 MB in background) + host esopianeti (`exoplanets.ts`, lazy 2 MB al focus). Selezione → fly-to (M3: istantaneo, centrato; tween in M5) + pannello. Host `matched:false` → selezione host via ricerca (unico percorso, SPEC §5.3).
- Store: `selection` union star|host, `hoveredStarIndex`, `pendingFlyTo` one-shot.
- Test: **42 unit** (Teff, format Intl — nota: CLDR it raggruppa solo da 5 cifre —, ricerca nomi, parse catalog-ids con BigInt, host map) + **7 e2e** (AC: Polaris via ricerca con valori letti dalla fixture; Polaris via **click** dopo fly-to centrato; TRAPPIST-1 via ricerca con badge non agganciato e 7 pianeti; hover label).

## Esiti verifica M3 (AC)

- AC M3 ✅: Polaris via click e via ricerca mostra dati corretti (fixture e dati completi: HD 8890 · HIP 11767 · TYC 4628-237-1, classe F, 432,6 a.l., B–V 0,636, Teff ≈5830 K, **variabile Sì** — è una Cefeide, flag HYG corretto). TRAPPIST-1 via ricerca: 7 pianeti, non agganciato. **Nota AC**: TRAPPIST-1 non è cliccabile *by design* — non è nella nuvola (V≈18,8, oltre Tycho-2; `matched:false`, SPEC §5.3): il percorso di selezione è la ricerca host.
- Vincolo ESLint (react-hooks nuove regole): niente setState sincrono negli effect → pattern "keyed async result" nei componenti; `react-hooks/immutability` disabilitato SOLO in `StarPicking.tsx` (mutazioni frame-scoped salva/ripristina del renderer, intrinseche al picking imperativo three.js).

## Cosa esiste (M2, in aggiunta a M0/M1)

- `app/src/data/starData.ts` — loader binario: manifest + fetch **per sezione via HTTP Range** (fallback a 200 full-body gestito); sezioni CORE (position, colorRGB, sizeAbsMag, spectralClass, flags ≈ 45% del file) attese per il primo paint, sezioni DETAIL (distanze, magnitudini, B–V, luminosità) in background → `starDetailsStore.ts` (fuori dallo store reattivo). Frame assi documentato: equatoriale eliocentrico, +x→RA 0h, +y→RA 6h, +z→polo nord celeste.
- `app/src/shaders/star.vert/.frag` — un solo `THREE.Points`/draw call: size da mag. assoluta con attenuazione prospettica 1/d, clamp [1,14] px, fade energetico ∝ px² sotto 1 px (flux-faithful), punto morbido gaussiano, additive blending, depthWrite off; bloom mipmap in post (`@react-three/postprocessing`).
- `GalaxyScene` — sfondo nero pieno, camera far 2e6 ly, `FlyControls` drei (free-fly, 25 ly/s, dragToLook); `?stats=1` FPS meter; `?pdb=1` preserveDrawingBuffer per i test pixel.
- `vite.config.ts` — plugin `serve-data-dir`: serve `/data/*` da `../data` in dev e preview **con supporto Range**.
- `LoadingOverlay` con progresso percentuale Intl + stato errore (i18n nei 5 locale).
- Test: 24 unit Vitest (loader validato contro la golden fixture, varianti 206/200) + 3 e2e Playwright (smoke; **nuvola su fixture con readPixels >100 pixel accesi**; messaggio di errore dati irraggiungibili).

## Esiti misure M2 (AC)

- **FPS su dati completi (2.491.335 stelle)**: 58.3 / 60.1 / 60.1 (3 run da 3 s, cap vsync 60) — 1920×1080, Chromium headless con GPU reale (ANGLE D3D11, NVIDIA RTX 3080), bloom attivo. **Budget 60 FPS rispettato** sull'hardware di sviluppo; `app/scripts/measure-fps.mjs` riusabile per M9.
- Bundle: 311→~315 KB gzip JS (entro budget 600 KB).
- Resa visiva: flux-faithful (stelle lontane sub-pixel quasi invisibili, come in cielo reale); tuning estetico (uPixelScale=60, bloom 1.1) rivedibile in M9 senza impatti architetturali.

### Gotcha operativi

- Su Windows, `Stop-Process` sul wrapper npm **non** uccide il figlio vite: server preview stantii restano sulla porta 4173 e servono codice vecchio (SPA fallback al posto di /data). Se i dati non caricano in preview: `Get-NetTCPConnection -LocalPort 4173` e killare il PID.

## Cosa esiste (M1, in aggiunta a M0)

- `data-pipeline/` completo: `fetch_athyg.py` (AT-HYG v3.3 ×2 + HYG v4.2, URL pinnati, sha256 in `data/raw/sources.json`), `fetch_exoplanets.py` (TAP `pscomppars`, 6298 righe), `transforms.py` (funzioni pure testate), `build_star_binary.py` (SoA little-endian per SPEC §5.1), `crossmatch.py` (Gaia→HD→HIP→nome→coordinate + patch flag bit2), `make_fixtures.py`, `conftest.py`, `tests/` (82 test verdi).
- Artefatti reali generati in `data/` (gitignored): `stars.bin` **102.1 MB / 2.491.335 stelle**, `stars.manifest.json` (con statistiche esclusioni), `names.index.json` **209.4 MB**, `exoplanets.json` 2.0 MB (4716 host / 6298 pianeti).
- Golden fixtures committate in `data-pipeline/fixtures/` (~160 KB, nomi file di produzione → drop-in data dir): 1000 stelle (Sol, Polaris, alf Cen A/B, Proxima + le più brillanti), sistemi TRAPPIST-1 (7 pianeti, non agganciato) e Proxima Cen (agganciato via Gaia).
- `NOTICE.md` aggiornato con DOI verificato `pscomppars` = **10.26133/NEA13**; CI ora esegue `pytest` sulla pipeline.

## Esiti dati reali (M1)

- Esclusioni loggate: 60.830 righe senza distanza su 2.552.165 (0 sentinelle 100000 pc in AT-HYG, 519 stelle senza tipo spettrale → classe 7 bianco neutro). Sol (dist=0) tenuto all'origine (eccezione documentata).
- Distanze: 98,8% ≤ 10.000 ly; p99.9 ≈ 19.600 ly; max ~1,02 M ly (poche centinaia di stelle con parallassi Gaia rumorose: valori di catalogo riportati tali e quali, non corretti).
- Cross-match: 1612/4716 host agganciati (1591 gaia, 14 hd, 4 hip, 3 coords); 3104 non agganciati (host deboli oltre il limite Tycho-2, es. Kepler) → `matched:false`, ricercabili per nome (SPEC §5.3/§10). "alf Cen A/b" non è più in pscomppars: il sistema Alpha Centauri delle fixture è **Proxima Cen**.
- TRAPPIST-1e risulta `in_hz=true` col modello conservativo √L (bordi 1.1/0.53 S⊕) — f e g restano fuori: coerente con bordi conservativi, documentato.

## ✅ Decisioni umane al CHECKPOINT 1 (2026-06-10) — implementate

1. **Split di `names.index.json`** (deviazione approvata dal contratto SPEC §5.1): ora è l'indice **classico** (proper/HD/HIP/Gl + costellazione, **16,3 MB**, ~318k stelle); gli id Gaia/TYC stanno in `catalog-ids.bin` (stride fisso 16 B, allineato all'indice → una Range request per stella) + `catalog-ids.manifest.json`, e la ricerca per id usa i bucket on-demand `search/gaia-XX.json` (bucket = `(id >> 35) % 256`: i bit bassi dei Gaia source id sono strutturati, il `% 256` puro collassava in 2 bucket — fix testato) e `search/tyc-XX.json` (`TYC1 % 256`). 512 file, ~120 MB totali ma scaricati solo a ricerche esplicite di id.
2. **Distanze estreme tenute** come verità di catalogo (~600 stelle oltre 10 kpc, max ~312 kpc, parallassi Gaia rumorose). **Revertibile**: `build_star_binary.py --max-distance-ly <valore>` applica un cut di qualità loggato e registrato nel manifest; il default resta nessun cut. Documentato anche nel docstring del modulo.

## Decisioni prese in M1 (oltre a quelle M0)

- Fonti pinnate: AT-HYG v3.3 (`athyg_v33-1/2.csv.gz`, endpoint LFS `/media/`), HYG v4.2 (`hyg_v42.csv.gz`), Codeberg astronexus. Parte 2 AT-HYG è senza header; `ra` in ore; `x0,y0,z0`/`dist` in pc.
- `pscomppars` non ha `gaia_id`: usate `gaia_dr3_id`/`gaia_dr2_id` + `sy_dist` (deviazione documentata dalla query d'esempio SPEC §5.2).
- Variabilità/multiplicità solo da HYG v4.2 (AT-HYG non le traccia): variable = `var`/`var_min` valorizzati; multiple = `base` non vuoto; stelle non-HYG → flag 0 ("sconosciuto" non codificabile nella bitmask — limite documentato).
- Luminosità derivata da absmag (convenzione HYG, V-band senza correzione bolometrica); white dwarf (`D…`) → classe 7; size ∝ √L con clamp; tutti i valori id in `names.index.json` sono stringhe (Gaia id > safe integer JS).
- Layout binario: sezioni float32 prima (allineamento 4 byte), uint8 dopo; il manifest elenca gli attributi nell'ordine SPEC §5.1 con offset espliciti.
- Match coordinate: tolleranza 5 arcsec + distanza ±10% se `sy_dist` presente; limite epoche J2000 vs Gaia documentato (gli alti moti propri matchano per id).
- `astropy`/`pyvo` pinnati ma non ancora usati (bastano numpy/requests); restano per M6 (costellazioni) o future verifiche.

## Assunzioni aperte / da verificare in implementazione

- Fonte e licenza del set di linee delle costellazioni (decidere in M6).
- Numeri di performance (FPS) sono **target**, da misurare in M2/M9.
- `data-refresh.yml` ancora placeholder: cablare la pipeline reale in M9.

## Checkpoint raggiunti

| Checkpoint | Milestone | Esito AC | Note |
|---|---|---|---|
| `[CHECKPOINT 0]` | M0 | ✅ tutti passati | build ok; scena nera renderizzata (Playwright + screenshot); lint/typecheck ok; 14 unit test verdi |
| `[CHECKPOINT 1]` | M1 | ✅ tutti passati | artefatti generati e validati contro schema (roundtrip test); fixtures committate; 82 pytest verdi (pc→ly, sentinelle, mappa colore, pack SoA, cross-match, golden); esclusioni loggate (60.830) in stdout e nel manifest |
| `[CHECKPOINT 2]` | M2 | ✅ tutti passati | rendering corretto su fixture (e2e readPixels) e su dati completi (screenshot ispezionato, 2.49M stelle); smoke visivo Playwright verde (3 test); FPS misurato 58–60 @1080p RTX 3080 vs budget 60 |
| — (M3, no checkpoint) | M3 | ✅ tutti passati | Polaris corretta via ricerca E via click (valori dalla fixture + spot check dati completi); TRAPPIST-1 via ricerca (non agganciata by design, badge + 7 pianeti) |
| `[CHECKPOINT 3]` | M4 | ✅ tutti passati | ogni filtro produce l'insieme visibile esatto (conteggi attesi calcolati dalla fixture); ricerca→fly-to ok (HD id incluso); stelle filtrate non pickabili; 62 unit + 15 e2e verdi ×2 run |

## Come riprendere

1. Leggi `docs/SPEC.md` e `AGENTS.md`.
2. Guarda "Milestone corrente / Prossimo passo" qui sopra — **CHECKPOINT 1 ha 2 punti aperti che richiedono decisione umana** prima di M3/M4 (il punto 1 può anche slittare: M2 usa solo stars.bin+manifest).
3. Pipeline: `cd data-pipeline && .venv/Scripts/python -m pytest` (82 test); rigenerare artefatti: `fetch_athyg.py` → `fetch_exoplanets.py` → `build_star_binary.py` → `crossmatch.py`.
4. M2 parte da `app/src/data/` (loader) e `app/src/scene/` + `app/src/shaders/`: leggere `.claude/skills/three-points-shader/SKILL.md`; le fixtures in `data-pipeline/fixtures/` sono una data-dir drop-in per i test.
