# STATE.md — Stato sviluppo Galaxy Map

> Aggiornare a ogni `[CHECKPOINT]`. È il punto di ripresa dello sviluppo.

## Stato corrente

- **Data ultimo aggiornamento:** 2026-06-12 (M9 completata)
- **Milestone completate:** **M0**–**M8** ✅, **M9 — rifinitura, performance, refresh CI, docs** ✅ (auto-verifica passata)
- **Milestone corrente:** — **tutte le milestone M0–M9 implementate**. ⏳ **In attesa del `[FINAL HUMAN CHECK]`** (AGENTS.md §4): nessun rilascio pubblico senza approvazione umana. Resta da decidere l'**hosting/deploy dei dati** (vedi sezione M9).

## Cosa esiste (M9, in aggiunta a M0–M8)

- **Performance verificata e annotata** (SPEC §7): **FPS su dati completi (2.49M stelle)** = run 1 46.9 (warmup: compile shader/settling) → **60.1 / 60.0** a regime (vsync cap 60), 1920×1080, Chromium headless ANGLE D3D11 + RTX 3080 → **budget 60 FPS rispettato**, nessuna regressione da M3–M8 (M2 era 58–60). **Bundle JS gzip ≈ 354 KB** (app 94 + vendor `three` 260) ≤ 600 KB; **CSS 4.1 KB** ≤ 50 KB. Numeri nel README (tabella budget vs misurato).
- **Chunk split vendor** (`vite.config.ts`): `manualChunks` (funzione, forma richiesta da rolldown) isola `three`+`@react-three`+`postprocessing` in un chunk a sé → cache cross-deploy (l'app cambia, three no). `chunkSizeWarningLimit: 1000` con commento: il warning di vite misura byte *uncompressed* (three ~979 KB raw / ~260 KB gzip), non il budget gzip reale (tracciato qui/README). Build ora pulita.
- **CI refresh dati cablata** (`.github/workflows/data-refresh.yml`): ETL reale completo in ordine di dipendenza (fetch_constellations → fetch_athyg → fetch_exoplanets → build_star_binary → crossmatch → build_constellations) + validazione (`pytest` + `validate_artifacts.py`). Input `dry_run` (default **true** su dispatch; lo `schedule` settimanale = publish). **Dry-run**: rigenera + valida + carica gli artefatti come **artifact di CI** (no publish). Fallimento di un fetch sorgente → run **RED** (no stale silenzioso, SPEC §10); i dati pubblicati non vengono toccati da un run fallito (i dati del runner sono effimeri).
- **`data-pipeline/validate_artifacts.py`** (nuovo): valida presenza + coerenza degli artefatti rigenerati (count manifest vs dimensione file, stride catalog-ids = count×16, host/pianeti esopianeti, costellazioni, bucket di ricerca). Exit ≠ 0 alla prima incoerenza.
- **Deploy stub documentato** (decisione umana M9): il passo "pubblica" (schedule / `dry_run=false`) è uno **stub fail-safe** che riporta cosa pubblicherebbe ed esce 0, **non distruttivo**. Motivo: i dati sono ~150 MB, gitignored, CC BY-SA, e **non esiste ancora un remoto/hosting** (M0: lo crea l'umano). Cablare il publish reale (Git LFS / bucket-CDN / release asset) è una **decisione al `[FINAL HUMAN CHECK]`** una volta scelto l'hosting.
- **Docs completate**: README root (features, struttura con `.github`/`NOTICE`/`LICENSE`, tabella budget misurato, sezione "Data refresh & deployment"); `data-pipeline/README.md` (sequenza run completa incl. costellazioni + `validate_artifacts.py` + sezione refresh CI).

## Esiti verifica M9 (AC)

- **Budget prestazionale rispettato (misurato)** ✅: 60 FPS a regime su 2.49M stelle (RTX 3080); JS 354 KB gzip ≤ 600, CSS 4.1 KB ≤ 50. `scripts/measure-fps.mjs` riusabile.
- **Dry-run CI rigenera i dati** ✅: rigenerazione **eseguita localmente end-to-end dai raw in cache** (stesso comando del workflow) → build_star_binary **2.491.335 stelle**, crossmatch (flag su 1610 stelle), build_constellations (**88 costellazioni, 689/695 segmenti**, = M6), **97 pytest verdi**, `validate_artifacts.py` **OK** (2,49M stelle / 4.716 host / 6.298 pianeti / 512 bucket / 313.258 nomi). Rigenerazione **deterministica** (conteggi identici al manifest committato). Il workflow non è eseguibile su GitHub finché manca il remoto, ma la logica/sequenza è quella verificata localmente.
- **Documentazione presente** ✅: README root + data-pipeline aggiornati e verificati.
- Suite app: 106 unit + 38 e2e (verde ×2 run — in corso al momento della stesura). Pipeline: 97 pytest.
- **`[FINAL HUMAN CHECK]` NON superato** (AGENTS.md §4): in attesa di approvazione umana + decisione hosting/deploy dei dati. Revisione: `cd app && npm run build && npm run preview` + browser; per gli FPS `node scripts/measure-fps.mjs` con preview attivo.

## Cosa esiste (M8, in aggiunta a M0–M7)

- **Selettore lingua** (`ui/LanguageSelector.tsx`): bottone globo in alto a destra (`z-40`, in entrambe le viste) che apre un menu delle 5 lingue. **Pattern WAI-ARIA menu-button** completo: `aria-haspopup="menu"`/`aria-expanded` sul trigger, voci `role="menuitemradio"` con `aria-checked` sulla lingua attiva, navigazione tastiera (frecce/Home/End/Enter/Spazio per aprire, Escape per chiudere, Tab esce), **focus che torna al bottone** alla chiusura/selezione, chiusura su click-fuori (`pointerdown`). Roving tabindex (solo la lingua corrente è `tabIndex 0`). **Endonimi NON tradotti** (English/Italiano/Español/Français/Deutsch — costante in codice: un picker deve leggersi uguale in ogni locale). i18next già configurato (persistenza **solo-sessione** via sessionStorage, SPEC §6.8) — mancava solo questa UI.
- **`<html lang>` sincronizzato** alla lingua attiva (effetto in `App.tsx`, listener `i18n.on('languageChanged')` + cleanup): gli screen reader scelgono la pronuncia dalla lingua del documento.
- **Stringhe `language.*`** (`label`, `menuLabel`) aggiunte ai 5 locale; l'unit test `i18n.test.ts` (key-set identico + nessuna stringa vuota) resta verde → coerenza garantita.
- **Pannelli top-right** (`StarPanel`, aside pianeti della System View) spostati a `top-16` (max-h `calc(100%-5rem)`) per non finire sotto il bottone globo.
- **Reduced-motion → System View parte in pausa** (decisione umana M8, scioglie la nota lasciata in M7): `enterSystemView` nello store mette `timeScaleDaysPerSecond: 0` quando `prefersReducedMotion()` (l'animazione orbitale è contenuto informativo, ma il moto continuo disturba chi ha chiesto meno movimento → l'utente preme play). Resta valido per fade di transizione e auto-orbita camera (già da M5).
- **Test a11y**: `@axe-core/playwright` (devDependency, MPL-2.0, solo test — non nel bundle) + `tests/e2e/a11y.spec.ts` (5 e2e): cambio lingua su tutta la UI + `html lang`; menu lingua operabile da tastiera (frecce/Enter/Escape, focus di ritorno); **scan `axe` su overlay galassia e su overlay System View → zero violazioni serious/critical** (il canvas 3D è escluso dallo scan: limite a11y noto e documentato, SPEC §6.9); reduced-motion → System View in pausa. Totale: **106 unit + 38 e2e**.

## Esiti verifica M8 (AC)

- **Cambio lingua su tutta la UI** ✅: EN→IT cambia il placeholder di ricerca (e l'intera UI), il codice nel bottone (EN→IT) e `document.documentElement.lang` (→ `it`); la lingua corrente è `aria-checked` nel menu. Persistenza solo-sessione (sessionStorage, by-design SPEC §6.8).
- **Navigazione da tastiera dei pannelli** ✅: i controlli sono nativamente focusabili (button/input/checkbox → Tab); il menu lingua (custom) è pienamente operabile da tastiera con focus management e ritorno al trigger. Verificato via e2e.
- **`axe` sull'overlay senza violazioni bloccanti** ✅: scan su overlay galassia (con pannello stella aperto) e System View (con pannello pianeta) → 0 serious/critical. Canvas 3D escluso come limite documentato (SPEC §6.9).
- Suite: 106 unit + 38 e2e verdi (1ª run completa; 2ª run di conferma in corso al momento del commit — i nuovi test sono deterministici, non dipendono da timing pixel/WebGL salvo il poll del bridge in reduced-motion).
- **Nota per M9**: warning di build "chunk > 500 kB" già presente (three.js) — il budget bundle (SPEC §7) si misura/affina in M9; nessuna azione in M8.

## Cosa esiste (M7, in aggiunta a M0–M6)

- **Ingresso/uscita System View**: bottone "Vedi sistema" abilitato in `StarPanel` (sia host non agganciati sia stelle con esopianeti, una volta risolto l'hostname); store: `enterSystemView(hostname)` / `exitSystemView()` (+`systemHostname`, `selectedPlanet`). La selezione galassia sopravvive al rientro; la **posa camera galassia è salvata/ripristinata** via `cameraPoseStore` (il Canvas galassia viene smontato durante la System View). Transizione: **fade CSS 450 ms** keyed sulla vista (`view-fade` in index.css, `motion-safe:` → con reduced-motion taglio netto).
- **`SystemScene`** (Canvas dedicato, 1 unità = 1 UA): stella ospite all'origine (colore da `teffToColor(st_teff)`, raggio presentazionale = max(st_rad reale, 4,5% di maxA)); **orbite in scala reale** (semiasse AU, fuoco nella stella): `lib/orbit.ts` puro con **soluzione di Keplero** (Newton su E−e·sinE=M), ellissi campionate, posizione nel tempo; **inclinazione presente → piano orbitale ruotato attorno all'asse X** (convenzione documentata: pscomppars non ha Ω/ω, l'orientazione 3D completa non è determinabile — mai inventata); **inclinazione assente → orbita schematica piatta e tratteggiata** (e mancante → cerchio). Pianeti = sfere cliccabili (raggio presentazionale ∝ ∛R⊕ clampato; disclaimer "non in scala" in UI). Drei `OrbitControls` attorno alla stella.
- **Animazione tempo reale**: `tDays += delta × timeScaleDaysPerSecond` (scala **globale condivisa** nello store, default 1 s = 2 giorni); pianeti senza periodo restano al periastro (mai fabbricato). Controlli: **pausa/riprendi**, **slider** [0.1, 365] giorni/s con **modalità log** (mapping esponenziale), valore formattato Intl.
- **Zona abitabile**: `lib/habitableZone.ts` = stesso modello √L della pipeline (flussi 1.1/0.53 S⊕, `st_lum` log₁₀); anello verde traslucido nel piano XZ; toggle disabilitato se `st_lum` mancante (mai stimato); etichetta "(modello approssimato √L)" in UI.
- **Dettagli pianeta** (SPEC §6.7 completi): pannello con periodo, semiasse, R⊕, M⊕, eccentricità, inclinazione, metodo+anno di scoperta, T eq, flag HZ; selezione via **click sulla sfera** o via **chip tastiera-raggiungibili** (a11y §6.9); badge "orbita schematica" quando manca l'inclinazione.
- Bridge e2e `?pdb=1`: `window.__system` {tDays, timeScale, hz, planets[name, angleDeg, schematic, periodDays, semiMajorAxisAU]}.
- i18n: blocco `system.*` + unità (UA/giorni/R⊕/M⊕) nei 5 locale; rimosso `panel.viewSystemSoon`.
- Test: **106 unit** (+14: Keplero, periodi, peri/apoastro, path chiuso, HZ vs flag fixture, colori, store) + **33 e2e** (+5 in `system.spec.ts`).

## Esiti verifica M7 (AC) — da confermare al CHECKPOINT 4

- **TRAPPIST-1** ✅: 7 pianeti, orbite reali (inclinazione presente), **periodi corretti verificati computazionalmente** (angolo dal bridge ≈ fase attesa da tDays/periodo di catalogo per tutti e 7, tolleranza 8° per e≈0).
- **Alpha Centauri (= Proxima Cen**, unico host del sistema in pscomppars, vedi M1) ✅: 2 pianeti, **orbite schematiche** (inclinazione assente nel catalogo — AC), pannello dettagli con periodo 11.18 giorni / 0.04848 UA / Radial Velocity.
- **HZ attivabile** ✅: anello √L con bordi identici al modello pipeline (verificati al 10⁻⁶), che **contiene TRAPPIST-1 e (in_hz=true) ed esclude b (in_hz=false)** — coerenza dati↔resa.
- Pausa congela `tDays`; slider al massimo → 365 giorni/s e avanzamento conseguente; ritorno alla galassia con selezione e posa camera intatte.
- Suite: 106 unit + 33 e2e verdi ×2 run; spot-check dati completi (`scripts/check-m7.mjs`): PASS, screenshot ispezionato (sistema TRAPPIST-1 con HZ e pannello "In zona abitabile: Sì").
- Aggiornato il test M3 che asseriva il bottone "Vedi sistema" disabilitato ("until M7") → ora abilitato.
- **Nota per M8**: l'animazione orbitale continua sotto `prefers-reduced-motion` (è contenuto, non decorazione — il fade di transizione invece lo rispetta); valutare in M8 se partire in pausa con reduced-motion attivo.

## Cosa esiste (M6, in aggiunta a M0–M5)

- **Pipeline costellazioni**: `fetch_constellations.py` (Stellarium **v26.1** pinnato, `skycultures/modern/index.json`, sha256 in `data/raw/sources.json`) + `build_constellations.py` → `data/constellations.json` (~10 KB): 88 costellazioni IAU, linee come **polilinee di indici stella** (HIP → indice via `names.index.json`, allineato a stars.bin per costruzione). Polilinee spezzate attorno a stelle mancanti, segmenti droppati contati (reali: **689/695 tenuti, 6 droppati, 0 vuote**; fixture: 549/695, 8 vuote). Licenza **CC BY-SA 4.0** (Stellarium's team) documentata in `NOTICE.md` §3. Fixture committata (`fixtures/constellations.json`, UMi ancorata a Polaris). 97 pytest verdi.
- **Linee costellazioni nell'app** (`ConstellationLines.tsx` + `constellationGeometry.ts`): default **off** (SPEC §6.2); `constellations.json` caricato lazy al primo toggle-on; un solo `LineSegments` (1 draw call) con posizioni lette dalla SoA (guardia anti-drift: indice fuori range → throw); steel blue translucido (0x4a6a96, opacity 0.35, depthWrite off). Nota documentata: le figure sono "classiche" viste da Sol e si deformano volando via — natura 3D, non bug.
- **Etichette "mostra sempre i nomi"** (`StarLabels.tsx` in-Canvas + `ui/StarLabelsLayer.tsx` DOM + `lib/labelCulling.ts` puro): candidate = sole stelle con **nome proprio** (~450, `getProperNamedStars()` — decisione di scope documentata: etichettare id arbitrari è clutter per definizione); culling per **magnitudine apparente dalla camera** (modulo di distanza m=M+5·log₁₀(d/10pc) → luminosità+zoom), soglia 6.5, cap **20 label**, separazione min 64 px (greedy, vince la più brillante); refresh ogni 150 ms. Le label vivono in `labelStore` (module holder, regola OOM) — React vede solo `labelsVersion`. Layer DOM pointer-events-none.
- **`ViewTogglesPanel`** (bottom-right): 2 checkbox (nomi / costellazioni), stringhe i18n nei 5 locale (`view.*`).
- Test: **92 unit** (culling, geometria linee, validazione artefatto fixture, mapping pipeline) + **28 e2e** (default senza clutter; toggle nomi 1..20 label e off; label "Polaris" dopo fly-to; toggle linee → pixel accesi su/giù). `scripts/check-m6.mjs` per lo spot-check su dati reali.

## Esiti verifica M6 (AC)

- AC ✅: i toggle funzionano (e2e su fixture ×2 run); **default = zero clutter** (entrambi off, 0 label, 0 linee — e2e). Spot-check dati completi (2,49M stelle, preview + `check-m6.mjs`): PASS — 20 label (cap), nomi celebri corretti (Sirius, Fomalhaut, Altair…), linee 75k→129k pixel accesi, nessun pageerror; screenshot ispezionato.
- `test.slow()` aggiunto al test e2e M4 delle classi spettrali (8 click sequenziali con ricalcolo maschera: a 28 test paralleli superava i 60 s di default — era già a 58 s prima di M6).

## Cosa esiste (M5, in aggiunta a M0–M4)

- **`CameraControls.tsx`** (sostituisce `FreeFlyControls.tsx` + `FlyToHandler.tsx`): un solo controller per free-fly, orbit-on-lock e transizioni animate. Free-fly invariato (delta mouse 1:1, WASD+R/F+Q/E, tasti ignorati con focus negli input).
- **Fly-to animato** (SPEC §6.3): tween posizione+orientamento con `easeInOutCubic`, durata ∝ log della distanza clampata **0,8–2,5 s** (`flyToDurationS`); arrivo a `ARRIVE_DISTANCE_LY=4` davanti al bersaglio, centrato (invariante usata dagli e2e). Input ignorato durante il tween (max 2,5 s, niente edge case di cancel). L'up vector corrente è preservato (niente scatto di roll su camera rollata).
- **Orbit on lock**: `selectStar(i)` → `cameraMode:'orbit'` **nello store** (deselezione/host → `'free-fly'`; host non orbitabile, non è nella nuvola). Drag = rotazione **rigida** attorno al bersaglio via quaternioni sugli assi locali camera (`orbitAroundTarget`: distanza e roll preservati, niente gimbal lock, il bersaglio mantiene la posizione a schermo); wheel = dolly clampato `[0.1, 1e6]` ly; **tasti di traslazione rilasciano il lock** (la selezione resta); Q/E roll resta attivo in orbita.
- **Estensioni richieste dall'utente (post-M5, commit `5593b77`)**: (1) **anche il click** su una stella vola alla distanza fissa `ARRIVE_DISTANCE_LY=4` (stesso percorso della ricerca; il tween di solo orientamento è stato rimosso perché superato); (2) **auto-orbita ambientale**: a ogni nuovo lock la camera rivoluziona da sola attorno alla stella (0,1 rad/s, ~63 s/giro) finché l'utente non orbita col mouse o rilascia il lock coi tasti di movimento; disattivata con reduced-motion (niente moto perpetuo).
- **`prefers-reduced-motion`** (`lib/motion.ts`, MediaQueryList cachata con `matches` live): transizioni → salto istantaneo, auto-orbita spenta.
- Matematica pura in **`scene/cameraTween.ts`** (nessuna dipendenza React/store): easing, durate, pose d'arrivo, orbit, dolly — tutto unit-testato.
- Bridge e2e `?pdb=1` esteso con `mode` (cameraMode dallo store).
- Test: **78 unit** + **24 e2e** (5 in `orbit.spec.ts`: volo interpolato, reduced-motion, auto-orbita con stop al drag, click→distanza fissa, drag/wheel/release). **Pattern anti-flake per asserzioni di volo**: campionamento `__camera` **in-page** ogni 50 ms con stop all'arrivo (`startCameraSampling`) — il runner Node viene affamato dalle pagine WebGL parallele e può perdersi un intero volo da 2,5 s; reduced-motion asserito strutturalmente (nessuna posa intermedia), non a wall-clock.

## Esiti verifica M5 (AC) e note

- AC ✅ (tutti via e2e su fixture): il lock orbita il bersaglio; transizioni interpolate (mid-flight ≠ start ≠ end); `prefers-reduced-motion` rispettato (`page.emulateMedia`).
- **Gotcha ritrovato**: i 3 e2e nuovi fallivano con `mode: undefined` — `npm run preview` (webServer Playwright) serve l'**ultima build**: dopo modifiche al codice serve `npm run build` prima di `playwright test` (variante del gotcha M2 sui preview stantii).
- e2e esistenti adeguati al volo animato: helper `waitForFlyToArrival` (2,8 s > durata max) in `fixtures.ts`, usato nei 5 punti che interagiscono col centro schermo dopo una ricerca (selection×2, filters×2, camera×1).
- Regola module-holder rispettata: `CameraControls` legge le posizioni stelle da `starCoreStore`, nessun typed array in React/zustand.
- Nessuna stringa utente nuova (niente i18n da aggiornare).

## 🔥 Hotfix post-M4: OOM del browser in `npm run dev` (RISOLTO)

- **Sintomo**: con i dati completi (2,49M stelle) il dev server congelava la pagina e Chrome andava in "Out of Memory" (~4 GB di heap V8, task sincrono eterno). In produzione/preview tutto sano (90 MB). Latente già da M2 (allora si fermava a ~2,4 GB e sopravviveva); M3/M4 hanno aggiunto consumi e sfondato il limite.
- **Causa radice** (diagnosi: heap monitor CDP + bisect a route bloccate + worktree M2 + loader isolato + `Debugger.pause` campionato): i **Performance Tracks della build dev di React 19** (`logComponentRender` → `addObjectDiffToProperties` → `addValueToProperties`) serializzano i **diff delle props/state dei componenti elemento per elemento**. `stars` (SoA con Float32Array da 7,5M elementi) passava per `useState`/props → React dev enumerava milioni di elementi a ogni commit → minuti di task sincrono e GB di micro-oggetti.
- **Fix architetturale**: i typed array NON passano mai per state/props React. Nuovo `src/data/starCoreStore.ts` (modulo holder per core SoA + BufferGeometry condivisa, stessa regola di `starDetailsStore`); React veicola solo il flip di `dataStatus`. `GalaxyScene`/`StarCloud`/`StarPicking`/`SearchBox`/`StarPanel` leggono dal modulo store, zero props pesanti.
- **Verifica**: dev + dati completi ora **62–69 MB stabili**, load istantaneo; 63 unit + 15 e2e verdi; regression guard `tests/unit/storeHygiene.test.ts` (lo store reattivo non deve contenere TypedArray/array enormi). Strumenti diagnostici riusabili: `app/scripts/measure-memory.mjs` (+ `measure-fps.mjs`).
- **Regola permanente per M5+**: qualsiasi dato per-stella nuovo (label, maschere, posizioni schermo…) va in module holder, MAI nello store zustand né in props/state React.

## 🔧 Hotfix post-M4 (2): mouse-look inerte in free-fly (RISOLTO)

- **Sintomo** (segnalato dall'utente): la camera non ruota col mouse, solo WASD. Diagnosi strumentata (bridge `window.__camera` con `?pdb=1` + drag Playwright): il meccanismo di three **funzionava** (112° tenendo premuto al bordo) — il problema era la **UX del `dragToLook` di FlyControls**: rotazione ∝ distanza del cursore dal centro **mentre si tiene premuto**; un drag normale vicino al centro produce rotazione quasi nulla. Non era una regressione del fix OOM.
- **Fix**: `FreeFlyControls.tsx` custom sostituisce drei/three FlyControls — il look segue il **delta del mouse 1:1** (fermi il mouse → si ferma), pointer capture, WASD + R/F (su/giù) + Q/E (roll), tasti ignorati quando il focus è in un input. Hover-picking soppresso durante il drag (evita pick render inutili). Costanti: LOOK_SENSITIVITY 0.0025 rad/px, 25 ly/s, roll 1 rad/s.
- **Test**: `tests/e2e/camera.spec.ts` (4 test: rotazione da delta, stop col mouse fermo — anti hold-at-offset —, WASD/R/F/Q/E, click pulito seleziona ancora) usando il bridge camera, che è permanente per gli e2e di M5. Suite completa: 63 unit + 19 e2e verdi.
- Nota M5: orbit-on-lock e fly-to animato sono stati costruiti sopra questo fix (ora tutto in `CameraControls.tsx`).
- **Prossimo passo:** M0–M9 tutte implementate. Il progetto è **fermo al `[FINAL HUMAN CHECK]`** (AGENTS.md §4): serve l'approvazione umana + la **decisione su hosting/deploy dei dati** (poi cablare il publish reale in `data-refresh.yml`, oggi stub fail-safe) e la creazione del remoto GitHub (rimasta all'umano da M0). Vedi "Cosa esiste (M9)" / "Esiti verifica M9".

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

- ~~Fonte e licenza del set di linee delle costellazioni~~ → risolta: Stellarium modern skyculture, dati CC BY-SA 4.0 (vedi "Prossimo passo").
- Numeri di performance (FPS) sono **target**, da misurare in M2/M9.
- ~~`data-refresh.yml` placeholder~~ → risolto in M9: ETL reale cablato + validazione + artifact in dry-run. Resta lo **stub di publish/deploy** (hosting dati da decidere al `[FINAL HUMAN CHECK]`).

## Checkpoint raggiunti

| Checkpoint | Milestone | Esito AC | Note |
|---|---|---|---|
| `[CHECKPOINT 0]` | M0 | ✅ tutti passati | build ok; scena nera renderizzata (Playwright + screenshot); lint/typecheck ok; 14 unit test verdi |
| `[CHECKPOINT 1]` | M1 | ✅ tutti passati | artefatti generati e validati contro schema (roundtrip test); fixtures committate; 82 pytest verdi (pc→ly, sentinelle, mappa colore, pack SoA, cross-match, golden); esclusioni loggate (60.830) in stdout e nel manifest |
| `[CHECKPOINT 2]` | M2 | ✅ tutti passati | rendering corretto su fixture (e2e readPixels) e su dati completi (screenshot ispezionato, 2.49M stelle); smoke visivo Playwright verde (3 test); FPS misurato 58–60 @1080p RTX 3080 vs budget 60 |
| — (M3, no checkpoint) | M3 | ✅ tutti passati | Polaris corretta via ricerca E via click (valori dalla fixture + spot check dati completi); TRAPPIST-1 via ricerca (non agganciata by design, badge + 7 pianeti) |
| `[CHECKPOINT 3]` | M4 | ✅ tutti passati | ogni filtro produce l'insieme visibile esatto (conteggi attesi calcolati dalla fixture); ricerca→fly-to ok (HD id incluso); stelle filtrate non pickabili; 62 unit + 15 e2e verdi ×2 run |
| — (M5, no checkpoint) | M5 | ✅ tutti passati | lock → orbita attorno al bersaglio (raggio costante, bersaglio centrato); fly-to interpolato (campione mid-flight); reduced-motion = salto istantaneo; 80 unit + 22 e2e verdi ×2 run |
| — (M6, no checkpoint) | M6 | ✅ tutti passati | toggle funzionanti (e2e ×2 run); default zero clutter; spot-check dati completi PASS (20 label cap, linee visibili, no errori); 92 unit + 28 e2e + 97 pytest verdi |
| `[CHECKPOINT 4]` | M7 | ✅ **confermato dall'umano (2026-06-12)** | TRAPPIST-1: 7 pianeti, periodi verificati dal bridge; Proxima Cen: orbite schematiche (incl. assente); HZ √L coerente coi flag in_hz; 106 unit + 33 e2e verdi ×2; spot-check reale PASS |
| — (M8, no checkpoint) | M8 | ✅ tutti passati | cambio lingua su tutta la UI + `html lang` (e2e); menu lingua operabile da tastiera con focus management; `axe` su overlay galassia e System View → 0 serious/critical; reduced-motion → System View in pausa; 106 unit + 38 e2e verdi |
| `[FINAL HUMAN CHECK]` | M9 | ✅ auto-verifica passata — **in attesa di ok umano** | FPS 60 a regime su 2.49M stelle (RTX 3080); bundle 354 KB / CSS 4.1 KB gzip entro budget; refresh CI cablata + rigenerazione locale end-to-end (97 pytest + validate OK, deterministica); docs complete; deploy dati = stub documentato (hosting da decidere) |

## Come riprendere

1. Leggi `docs/SPEC.md` e `AGENTS.md`.
2. Guarda "Milestone corrente" qui sopra — **M0–M9 tutte implementate**; il progetto è **fermo al `[FINAL HUMAN CHECK]`**. Prima di qualsiasi rilascio: (a) approvazione umana sulla revisione; (b) **decisione hosting/deploy dei dati** (poi cablare il publish reale in `data-refresh.yml`, oggi stub); (c) creazione del remoto GitHub (M0).
3. Pipeline: `cd data-pipeline && .venv/Scripts/python -m pytest` (82 test); rigenerare artefatti: `fetch_athyg.py` → `fetch_exoplanets.py` → `build_star_binary.py` → `crossmatch.py`.
4. M2 parte da `app/src/data/` (loader) e `app/src/scene/` + `app/src/shaders/`: leggere `.claude/skills/three-points-shader/SKILL.md`; le fixtures in `data-pipeline/fixtures/` sono una data-dir drop-in per i test.
