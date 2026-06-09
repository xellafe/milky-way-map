# Galaxy Map — Documento di Specifiche (SPEC.md)

- **Versione documento:** 1.0
- **Data:** 2026-06-09
- **Stato:** Approvato per implementazione
- **Destinatario:** agente LLM implementatore (es. Claude Code)

---

## 0. Come usare questo documento (LEGGERE PRIMA DI SCRIVERE CODICE)

1. Leggi l'intero documento prima di iniziare.
2. Esegui le **milestone in ordine** (Sezione 9). Ogni milestone ha **acceptance criteria verificabili**: devi eseguirli e superarli **prima** di passare alla successiva.
3. Fermati ai marcatori `[CHECKPOINT]`: scrivi/aggiorna `STATE.md` (vedi §11) e attendi. Lo sviluppo può essere ripreso in seguito partendo da `STATE.md`.
4. Il `[FINAL HUMAN CHECK]` è **obbligatorio**: nessun rilascio pubblico prima dell'approvazione umana.
5. I **Non-Goals** (§1) sono vincolanti. Non ampliare lo scope.
6. Non cambiare lo **stack core** o le versioni pinnate senza approvazione umana.
7. **Non fabbricare mai valori astronomici.** Dato mancante = `n/d` / `null`, mai inventato.

### Legenda etichette
- `[Decisione]` — scelta di progetto deliberata (non un fatto, ma vincolante per l'implementazione).
- `[Inferenza]` — ragionamento basato su pattern noti; da verificare in fase di implementazione.
- `[Non verificato]` — affermazione tecnica da confermare con misurazioni reali.

---

## 1. Overview & Non-Goals

**Cos'è.** *Galaxy Map* è una **web app desktop** che visualizza in **3D** il vicinato stellare locale in coordinate **eliocentriche**, usando i dati reali dei cataloghi **HYG** e **AT-HYG**. L'utente naviga la nuvola di stelle, ne ispeziona i dettagli, e può entrare ("zoom in") nel sistema di una stella che ospita esopianeti per vederne le orbite animate in tempo reale e in scala.

**Cosa NON è (Non-Goals, vincolanti):**
- ❌ Non rappresenta *tutte* le stelle della Via Lattea in posizione 3D reale (impossibile — vedi nota sotto).
- ❌ Nessun supporto mobile/touch in v1 (solo desktop web).
- ❌ Nessun funzionamento offline.
- ❌ Nessun backend applicativo in v1 (dati statici serviti da CDN).
- ❌ Nessuna galassia procedurale/artistica di sfondo (sfondo nero pieno).
- ❌ Nessun account utente, nessun salvataggio lato server.
- ❌ Nessun VR/AR.

> **Nota di realtà [Inferenza].** Una posizione 3D affidabile deriva dalla parallasse, il cui errore cresce con la distanza: oltre poche migliaia di parsec la posizione diventa rumore. Per questo *Galaxy Map* renderizza **solo le stelle con una distanza misurata valida** (di fatto il vicinato locale, dove la parallasse è significativa). Le voci di catalogo prive di distanza valida vengono escluse dalla scena 3D e conteggiate (vedi §10).

---

## 2. Glossario di dominio

| Termine | Definizione operativa |
|---|---|
| Parallasse | Spostamento angolare apparente; base per la distanza stellare. |
| Parsec (pc) | Unità di distanza. **1 pc = 3.2616 anni luce (ly).** |
| Anno luce (ly) | Unità mostrata all'utente in tutta l'app. |
| Magnitudine apparente | Luminosità vista dalla Terra. |
| Magnitudine assoluta | Luminosità a 10 pc; **usata per la dimensione del punto stella**. |
| Indice di colore (B–V) | Proxy di temperatura/colore; base per il colore RGB. |
| Tipo spettrale | Classe O, B, A, F, G, K, M (dal più caldo/blu al più freddo/rosso). |
| Sequenza principale (MS) | Fase stabile di fusione dell'idrogeno. |
| Teff | Temperatura efficace (K). |
| AU | Unità astronomica (~distanza Terra–Sole). |
| Periodo orbitale | Tempo di rivoluzione di un esopianeta. |
| Semiasse maggiore | Dimensione dell'orbita (AU); **usato per la scala reale delle orbite**. |
| Eccentricità / Inclinazione | Forma e tilt dell'orbita. |
| Zona abitabile (HZ) | Fascia orbitale dove l'acqua liquida è teoricamente possibile (modello approssimato). |
| Multiplicità | Appartenenza a sistema stellare multiplo. |

---

## 3. Stack tecnologico (VINCOLATO)

> Pinna le **versioni stabili più recenti** in fase M0 e registrale nel lockfile. Non introdurre librerie core alternative senza approvazione umana.

**Frontend**
- TypeScript (strict mode)
- React
- `three` (Three.js)
- `@react-three/fiber` (R3F)
- `@react-three/drei`
- `postprocessing` / `@react-three/postprocessing` (bloom)
- Vite (build tool)
- Zustand (stato globale)
- Tailwind CSS (UI 2D / overlay)
- `i18next` + `react-i18next` (internazionalizzazione)

**Data pipeline (ETL offline)**
- Python 3.x
- `pandas`, `numpy`
- `astropy`
- `pyvo` o `requests` (query TAP)

**Test / qualità**
- Vitest (unit)
- Playwright (smoke test del rendering / e2e)
- ESLint + Prettier

**CI**
- GitHub Actions (refresh dati periodico + build)

`[Decisione]` Nessun backend in v1: i dati sono artefatti statici generati offline e serviti come file.

---

## 4. Architettura

### 4.1 Flusso dati
```
[AT-HYG / HYG CSV]  ─┐
                     ├─► [Python ETL] ─► stars.bin + stars.manifest.json + names.index.json
[NASA Exoplanet TAP]─┘                └─► exoplanets.json
                                          │
                                   (static assets, CDN)
                                          │
                                   [React + R3F app] ─► GPU (single Points cloud)
```

### 4.2 Rendering
- La nuvola di stelle è **un singolo oggetto `THREE.Points`** con **shader GLSL custom** (vertex + fragment). **Mai una mesh per stella.**
- Attributi GPU in layout **SoA** (Structure of Arrays): posizioni, colori, dimensioni, classe spettrale, flag.
- UI 2D (ricerca, filtri, pannelli) come **overlay DOM** sopra il canvas.

### 4.3 Stato (Zustand)
Store unico con: stella selezionata, filtri attivi, modalità camera, toggle (nomi, costellazioni, zona abitabile), scala temporale, lingua, vista corrente (galaxy | system).

### 4.4 Struttura cartelle
```
galaxy-map/
├── app/                      # frontend (Vite + React + R3F)
│   ├── src/
│   │   ├── scene/            # Three/R3F: StarCloud, Constellations, SystemView, Camera
│   │   ├── shaders/          # GLSL (star.vert, star.frag)
│   │   ├── ui/               # pannelli, ricerca, filtri (DOM overlay)
│   │   ├── state/            # store Zustand
│   │   ├── data/             # loader binari + tipi
│   │   ├── i18n/             # i18next + locales/{en,it,es,fr,de}.json
│   │   └── lib/              # utilità (coordinate, colore, HZ, scala tempo)
│   └── tests/
├── data-pipeline/            # Python ETL
│   ├── fetch_athyg.py
│   ├── fetch_exoplanets.py
│   ├── build_star_binary.py
│   ├── crossmatch.py
│   └── fixtures/             # golden files per i test
├── data/                     # artefatti generati (politica gitignore/LFS in §11)
├── docs/
│   ├── SPEC.md               # questo documento
│   └── STATE.md              # stato sviluppo (resumption)
├── AGENTS.md                 # convenzioni agente (§11)
└── README.md
```

---

## 5. Contratti dati

### 5.1 Formato binario stelle (`stars.bin` + `stars.manifest.json`)

`[Decisione]` Layout SoA, little-endian. Il manifest descrive offset e conteggi.

Attributi per stella (indice `i` in `[0, N)`):
| Attributo | Tipo | Note |
|---|---|---|
| position | Float32 ×3 | x, y, z in **ly**, eliocentrico (assi HYG) |
| colorRGB | Uint8 ×3 | colore precomputato (vedi §6.1) |
| sizeAbsMag | Float32 | derivato da magnitudine **assoluta** |
| spectralClass | Uint8 | 0=O … 6=M, 7=sconosciuto |
| distanceLy | Float32 | distanza in ly |
| appMag | Float32 | magnitudine apparente |
| absMag | Float32 | magnitudine assoluta |
| colorIndex | Float32 | B–V (NaN se assente) |
| luminosity | Float32 | L☉ (NaN se assente) |
| flags | Uint8 | bitmask: bit0 variabile, bit1 multipla, bit2 hasExoplanets |

`stars.manifest.json`: `{ version, count, units:"ly", frame:"heliocentric", attributes:[...offsets...] }`

**Index nomi/ID** (`names.index.json`, caricato lazy per ricerca e pannello):
`{ [i]: { proper?: string, hd?, hip?, gaia?, gl?, tyc?, constellation? } }`

**Convenzioni e sentinelle:**
- Conversione pc → ly = `× 3.2616`.
- **Escludi** voci con distanza sentinella HYG (`100000` pc) o non finita.
- Stella senza tipo spettrale/colore → `spectralClass=7`, colore bianco neutro, flag loggato.

### 5.2 Esopianeti (`exoplanets.json`)

Fonte: **NASA Exoplanet Archive**, tabella `pscomppars` via TAP (sincrono). Query di esempio:
```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=
 select pl_name,hostname,hd_name,hip_name,gaia_id,
        pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_orbeccen,pl_orbincl,
        discoverymethod,disc_year,pl_eqt,
        st_teff,st_lum,st_rad,ra,dec
 from pscomppars&format=json
```

Schema per sistema:
```json
{
  "hosts": {
    "TRAPPIST-1": {
      "starRef": { "matchedIndex": 12345, "matchedBy": "gaia", "matched": true },
      "st_teff": 2566, "st_lum": -3.2, "st_rad": 0.12,
      "planets": [
        { "pl_name": "TRAPPIST-1 b", "pl_orbper": 1.51, "pl_orbsmax": 0.011,
          "pl_rade": 1.12, "pl_bmasse": 1.37, "pl_orbeccen": 0.006,
          "pl_orbincl": 89.6, "discoverymethod": "Transit", "disc_year": 2016,
          "pl_eqt": 400, "in_hz": false }
      ]
    }
  }
}
```
Campi nullable quando assenti (es. `pl_orbincl: null` → orbita schematica 2D).

### 5.3 Cross-match stella ↔ esopianeti
`[Inferenza — punto delicato]` Il collegamento tra host esopianetario e stella di catalogo è imperfetto. Strategia in ordine di priorità:
1. ID catalogo (Gaia → HD → HIP).
2. Nome proprio normalizzato.
3. Match per coordinate (RA/Dec) entro tolleranza piccola.

Host non agganciato a una stella della nuvola → `matched:false`: il sistema resta comunque visitabile via ricerca per nome host, ma viene **segnalato come non agganciato**.

### 5.4 Golden fixtures (per i test)
Genera in M1: campione di ~1000 stelle + sistemi **TRAPPIST-1** e **Alpha Centauri** completi. I test di rendering e cross-match usano questi file deterministici.

---

## 6. Requisiti funzionali

### 6.1 Rendering nuvola di stelle
- **Colore** `[Decisione]`: mappa indice di colore / classe spettrale → rampa RGB tipo corpo nero, con **boost di saturazione artistico** (costante `COLOR_SATURATION_BOOST`, default modesto) per "epicità", pur restando riconoscibile. È una scelta estetica documentata: le stelle reali appaiono quasi bianche. Ancore indicative:
  - O ≈ `#9BB0FF`, B ≈ `#AABFFF`, A ≈ `#CAD7FF`, F ≈ `#F8F7FF`,
    G ≈ `#FFF4EA`, K ≈ `#FFD2A1`, M ≈ `#FFCC6F`→`#FFA46E`, sconosciuto ≈ bianco neutro.
- **Dimensione**: da magnitudine **assoluta** (più luminosa → più grande), con clamp min/max e attenuazione prospettica con la distanza.
- **Bloom/glow** via post-processing.
- **Sfondo**: nero pieno (nessuna skybox).

### 6.2 Etichette
- **Nomi stella**: visibili **all'hover** (nome proprio se presente, altrimenti ID catalogo primario). Toggle "mostra sempre i nomi" con **culling** per luminosità/zoom per evitare clutter.
- **Costellazioni**: linee **nascoste di default**, toggle per abilitarle. (Sorgente linee: asterismi standard o da ID costellazione HYG — documentare la fonte scelta.)

### 6.3 Camera e navigazione
- Due modalità: **free-fly** e **orbit**.
- Su **lock/selezione** di un corpo → passaggio automatico a **orbit** attorno ad esso.
- Transizioni **animate e fluide** (tween) sia per fly-to che per ingresso in System View.

### 6.4 Ricerca
- Per **nome comune** (es. `Polaris`) o **ID catalogo** (HD/HIP/Gaia/Gl/GJ/TYC). Prefix/fuzzy.
- Selezione → fly-to + apertura pannello dettagli.

### 6.5 Filtri runtime `[Decisione]`
Applicati lato GPU (maschera di visibilità via attributo), **senza ricaricare** i dati:
- Tipo spettrale (multi-select O/B/A/F/G/K/M)
- Range distanza (ly)
- Range magnitudine apparente
- Range magnitudine assoluta
- Solo stelle con esopianeti
- Solo sistemi multipli
- Solo variabili

### 6.6 Pannello dettagli stella `[Decisione]`
Campi: nome proprio, ID catalogo, tipo spettrale, classe MS, distanza (ly), mag. apparente, mag. assoluta, indice di colore (B–V), luminosità (L☉), Teff stimata, multiplicità, variabilità, **età stimata** (etichettata "stima incerta", `n/d` se assente — mai fabbricata), indicatore **"ha esopianeti"** → pulsante per entrare in System View.

### 6.7 System View (esopianeti)
- **Orbite in scala reale** (semiasse in AU). Ellisse 3D inclinata dove `pl_orbincl` è presente; **ellisse/cerchio schematico 2D** se l'inclinazione è assente.
- **Animazione in tempo reale** con **scala temporale globale condivisa**.
  - `[Decisione]` Default: **1 secondo reale = 2 giorni**. Slider regolabile + **modalità logaritmica** opzionale.
  - `[Inferenza]` Una singola scala lineare **non rende apprezzabili insieme** orbite di ~1 giorno e di diversi anni (range dinamico enorme): per questo lo slider e la modalità log sono parte integrante, non opzionali.
- **Zona abitabile**: toggle on/off. Calcolata da luminosità/Teff stellare con un **modello semplice e documentato** (bordi che scalano con √L). `[Inferenza]` Modello approssimato, da etichettare come tale in UI.
- **Dettagli esopianeta** `[Decisione]`: nome, periodo orbitale (giorni), semiasse (AU), raggio (R⊕), massa (M⊕), eccentricità, inclinazione, metodo e anno di scoperta, temperatura di equilibrio, flag "in zona abitabile".

### 6.8 UI / i18n
- Lingue: **EN (default)**, IT, ES, FR, DE. Tutte le stringhe esternalizzate in `locales/*.json` via i18next.
- Selettore lingua persistente nella sessione.

### 6.9 Accessibilità (best effort)
`[Inferenza]` Una scena 3D a navigazione libera è intrinsecamente poco accessibile. Mitigazioni richieste:
- UI 2D completamente operabile da **tastiera**, con ARIA e gestione del focus.
- La **ricerca** funge da percorso di navigazione accessibile (raggiungere una stella senza mouse 3D).
- Rispetto di `prefers-reduced-motion` (riduce/disabilita le transizioni animate).
- Il canvas 3D viene riconosciuto come limite noto e documentato.

---

## 7. Requisiti non funzionali / budget prestazionali

`[Non verificato — sono target da misurare]`
- **60 FPS** su desktop di fascia medio-alta con la nuvola completa AT-HYG, tramite: single draw call, buffer SoA, **GPU picking**, culling per frustum e LOD per distanza, caricamento lazy dell'index nomi/metadati.
- **Caricamento progressivo**: mostrare la nuvola il prima possibile (streaming/chunk), non bloccare sul download completo.
- Baseline **WebGL2**; messaggio di fallback chiaro se non supportato.
- Budget dimensione bundle definito in M0 e verificato in M9.

---

## 8. Refresh dati
- Pipeline eseguita **periodicamente** via GitHub Actions (cron): ri-scarica AT-HYG (sorgente Codeberg) e gli esopianeti (NASA TAP), rigenera gli artefatti, li committa/deploya.
- URL sorgente pinnati e versionati.
- Nessun funzionamento offline.

---

## 9. Milestone (M0–M9)

Ogni milestone: **obiettivo → deliverable → acceptance criteria (verificabili) → checkpoint**.

### M0 — Init progetto & tooling
- `git init` (repo **locale**; il remoto GitHub sarà creato dall'umano in seguito).
- Scaffolding cartelle, dipendenze pinnate (lockfile), ESLint/Prettier/TS strict, config Vitest/Playwright, skeleton CI.
- **AC:** la app builda; scena vuota (sfondo nero) renderizza; lint e type-check passano.
- `[CHECKPOINT 0]`

### M1 — Data pipeline
- ETL Python: download AT-HYG + HYG → pulizia → `stars.bin` + manifest + `names.index.json`; download esopianeti → `exoplanets.json`; cross-match (§5.3); generazione golden fixtures (§5.4).
- **AC:** artefatti prodotti e validati contro lo schema; fixtures presenti; unit test sulle trasformazioni (conversione pc→ly, esclusione sentinelle, mappa colore) verdi; conteggio stelle escluse loggato.
- `[CHECKPOINT 1]`

### M2 — Rendering nuvola
- Loader binario; `Points` con shader; colore + dimensione + bloom; sfondo nero; camera free-fly.
- **AC:** rendering corretto su fixture e poi su dati completi; smoke test visivo Playwright; FPS misurato e annotato rispetto al budget.
- `[CHECKPOINT 2]`

### M3 — Picking, selezione, pannello dettagli
- GPU picking; etichetta hover; click-select; pannello dettagli stella (§6.6).
- **AC:** selezionando **Polaris** e **TRAPPIST-1** (via click e via ricerca) i dati mostrati sono corretti.

### M4 — Ricerca & filtri
- Box di ricerca (§6.4); filtri runtime (§6.5) via maschera GPU.
- **AC:** ogni filtro modifica correttamente l'insieme visibile; ricerca → fly-to funzionante.
- `[CHECKPOINT 3]`

### M5 — Modalità camera & transizioni
- Free-fly + orbit on lock; fly-to animato.
- **AC:** il lock orbita il bersaglio; transizioni interpolate; rispetto di `prefers-reduced-motion`.

### M6 — Etichette & costellazioni
- Nomi su hover + toggle "sempre" con culling; linee costellazioni con toggle (default off).
- **AC:** i toggle funzionano; nessun clutter alla configurazione di default.

### M7 — System View & esopianeti
- Ingresso nel sistema; orbite in scala reale; animazione tempo reale + slider scala temporale + modalità log; toggle zona abitabile; dettagli pianeta (§6.7).
- **AC:** **TRAPPIST-1** (7 pianeti) e **Alpha Centauri** renderizzati con periodi/animazione corretti; HZ attivabile; orbite schematiche quando manca l'inclinazione.
- `[CHECKPOINT 4]`

### M8 — i18n & accessibilità
- Locale EN/IT/ES/FR/DE; pass a11y sulla UI 2D; reduced-motion.
- **AC:** cambio lingua funziona su tutta la UI; navigazione da tastiera dei pannelli; check `axe` sull'overlay senza violazioni bloccanti.

### M9 — Rifinitura, performance, refresh CI, docs
- Profiling fino al budget; CI cron di refresh dati; README completo.
- **AC:** budget prestazionale rispettato (misurato); dry-run CI rigenera i dati; documentazione presente.
- `[FINAL HUMAN CHECK]` — **obbligatorio prima di qualsiasi rilascio pubblico.**

---

## 10. Gestione errori e fallback
| Caso | Comportamento |
|---|---|
| Stella senza distanza valida / sentinella | Esclusa dalla scena 3D; conteggio loggato. |
| Stella senza tipo spettrale/colore | Bianco neutro; flag loggato. |
| Stella senza età | Pannello mostra `n/d` (nessun valore inventato). |
| Host esopianetario non agganciato a una stella | Sistema visitabile via ricerca host; segnalato "non agganciato". |
| Esopianeta senza inclinazione | Orbita schematica 2D. |
| Fallimento TAP/rete nel refresh | Mantieni i dati committati precedenti; la CI fallisce in modo visibile; la app non è impattata. |
| WebGL2 non disponibile | Messaggio di fallback amichevole. |

---

## 11. Convenzioni agentiche (contenuto di `AGENTS.md`)

**Fai:**
- Esegui le milestone in ordine; **auto-verifica gli acceptance criteria** prima di proseguire.
- Un commit/PR per milestone; messaggi chiari.
- Pinna le versioni; scrivi i test insieme al codice.
- Esternalizza tutte le stringhe utente; funzioni piccole e testabili.
- Documenta ogni assunzione sui dati astronomici.
- A ogni `[CHECKPOINT]` aggiorna `STATE.md` con: cosa è fatto, cosa manca, decisioni aperte → per consentire la ripresa.

**Non fare:**
- Cambiare stack/versioni core senza approvazione umana.
- **Fabbricare valori astronomici.**
- Renderizzare mesh per singola stella.
- Committare grandi dati generati senza politica gitignore/LFS.
- Saltare gli acceptance criteria.
- Superare il `[FINAL HUMAN CHECK]`.

**Subagent suggeriti:** data-pipeline, rendering/shader, UI/UX, i18n/a11y, test/QA.

**Skill file suggeriti:** `athyg-etl`, `tap-exoplanet-fetch`, `three-points-shader`, `react-i18n-setup`.

**Politica dati nel repo:** artefatti generati grandi → `data/` in gitignore (o Git LFS); fixtures piccole committate.

**Protocollo di ripresa:** alla ripresa, leggi `STATE.md` e l'ultimo `[CHECKPOINT]` raggiunto prima di continuare.

---

## 12. Attribuzione e licenza (FINALIZZATA)
- **Codice**: licenza **MIT** (`LICENSE`).
- **Dati HYG / AT-HYG**: restano sotto **CC BY-SA 4.0** (autore: astronexus / David Nash) → obbligo di **attribuzione** e **share-alike** sul dataset/derivato.
- **NASA Exoplanet Archive**: acknowledgment standard + DOI dell'archivio (l'agente deve verificare il DOI esatto della tabella `pscomppars` sul sito ufficiale al momento del fetch).
- Tutte le attribuzioni sono raccolte nel file **`NOTICE.md`** in root.
- `[Decisione]` Separazione netta codice (MIT) / dati (CC BY-SA): i dati bundlati conservano la loro licenza; il `NOTICE.md` rende esplicita la doppia natura.

---

## 13. Decisioni finalizzate (ex differite)
Valori scelti e vincolanti per v1 (modificabili in seguito senza impatto architetturale):

- **`COLOR_SATURATION_BOOST` = 1.35**: dopo aver calcolato la RGB-ancora per classe spettrale, aumenta la saturazione HSL del fattore 1.35 (clamp a 1.0) e alza un floor di luminosità minimo così che le M deboli restino visibili. Documentato come scelta estetica.
- **Scala temporale System View**: default **1 s reale = 2 giorni**; slider da **0.1 a 365 giorni/s**; **modalità logaritmica** togglabile; valore `0` = animazione in pausa.
- **Soglie filtri**: nessun pre-filtro all'avvio (mostra tutto). I bound degli slider (distanza, mag. app./ass.) sono derivati dal **min/max reale dei dati** al caricamento. Toggle "ha esopianeti", "multipla", "variabile" tutti **off** di default.
- **Lingue**: EN (default), IT, ES, FR, DE. Confermate, nessuna aggiunta in v1.
- **Modello zona abitabile**: riferimento **Kopparapu et al. (2013)**, bordi conservativi. `[Inferenza]` Per v1 è accettabile l'approssimazione semplificata con bordi che scalano come √L usando limiti di flusso conservativi (~1.1 S⊕ interno, ~0.53 S⊕ esterno). L'agente deve documentare nel codice il modello effettivamente usato ed etichettarlo "approssimato" in UI.
