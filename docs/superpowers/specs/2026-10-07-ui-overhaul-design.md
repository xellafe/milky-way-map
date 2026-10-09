# Overhaul della UI desktop (issue #23) — design

- **Issue:** [xellafe/milky-way-map#23](https://github.com/xellafe/milky-way-map/issues/23) — "Overhaul the UI"; include [xellafe/milky-way-map#10](https://github.com/xellafe/milky-way-map/issues/10)
- **Sostituisce in parte:** `2026-09-30-sci-fi-ui-design.md` (issue #3): pannello dettagli, overlay di selezione, dock e stile dei componenti.

## Obiettivo

Rifare la UI desktop di Galaxy Map con un linguaggio visivo nuovo e una
libreria di componenti condivisa, eliminando le informazioni ripetute e
riorganizzando la posizione di dati e controlli nella galassia e nella
System View. Include la issue #10 (camera che segue il pianeta selezionato).

## Perimetro

La issue #23 è divisa in due sottoprogetti, ciascuno con il proprio ciclo
spec → piano:

1. **Questo documento:** componenti custom, informazioni ripetute, posizione
   delle informazioni, su desktop.
2. **Interfaccia mobile:** spec separata. Richiede la modifica di SPEC §1
   (oggi "Nessun supporto mobile/touch in v1") con approvazione umana, layout
   touch e gesti della camera.

Fuori perimetro: mobile, issue #8 e #9.

## Stato attuale (problemi)

- **Duplicazione:** con una stella selezionata, la card che segue la stella
  (`SelectionOverlay`) e il pannello in alto a destra (`StarPanel`) mostrano
  gli stessi dati: titolo, 4 tile (distanza, temperatura, luminosità,
  magnitudine apparente), badge "N pianeti noti".
- **Sovrapposizioni:** nella System View la barra "Scala temporale" copre il
  pannello dei dettagli del pianeta; il pannello "Pianeti" mescola filtri,
  stile orbite, elenco e dettagli.
- **Componenti:** checkbox, slider e select sono nativi con il solo
  `accent-color`; pulsante ✕, riga etichetta/valore e `<details>` sono
  ripetuti a mano in più file.
- **Leggibilità:** il gauge della magnitudine apparente è difficile da
  leggere (asse al contrario, segno "occhio nudo" poco evidente).

## Decisioni (con l'umano)

| Tema | Decisione |
|---|---|
| Fonte unica dei dati della stella | la card che segue la stella; `StarPanel` eliminato |
| Modalità della card | **Base** (contenuto attuale della card) e **Advanced** (aggiunge i dati del pannello eliminato), con animazione dedicata |
| Advanced | la card resta agganciata all'oggetto e si allarga in orizzontale su due colonne |
| Host non ancorati | la selezione dalla ricerca porta direttamente nella System View; i dati della stella vanno lì |
| Layout System View | pannello fisso a sinistra (stella), pannello fisso a destra (elenco pianeti) |
| Pianeta selezionato (#10) | clic sul pianeta o sulla riga: selezione, camera che lo segue, card ancorata come per le stelle |
| "Vedi sistema" | in Base il badge "N pianeti noti" diventa pulsante "N pianeti noti · Vedi sistema →"; in Advanced resta in fondo |
| Componenti | libreria condivisa **con nuovo linguaggio visivo** |
| Stile | "HUD raffinato": evoluzione dell'attuale (vedi §1) |
| Scale dei gauge | le scale attuali (tacche, rampa spettrale) ridisegnate nel nuovo stile |
| Magnitudine apparente | asse invertito, zone "occhio nudo" (−1…6) e "binocolo" (6…9), verdetto testuale |
| Card del pianeta | Base con 4 tile con gauge, come la stella |
| Persistenza Base/Advanced | sì, una preferenza unica per stelle e pianeti, salvata in localStorage |
| Dock | pannello unico a schede |
| Contenuti del dock | pulsanti colorati per le classi spettrali, slider a due cursori, interruttori, sezioni, "Reimposta" in intestazione |

## Approccio

**Evoluzione sul posto.** I componenti nuovi stanno in `app/src/ui/hud/`
accanto a quelli esistenti, che vengono ridisegnati. I token di stile restano
in `@theme` di `app/src/index.css`; il CSS custom resta in
`@layer components` (AGENTS.md, trappola 2). Nessuna dipendenza nuova: niente
librerie headless, niente webfont.

Scartati: libreria headless esterna (Radix/Headless UI), perché è una
dipendenza nuova sovradimensionata per pochi controlli; riscrittura da zero di
`ui/`, perché rompe test e `data-testid` senza vantaggio.

## Design

### 1. Linguaggio visivo

- Palette invariata (blu ghiaccio: `hud-accent`, `hud-bright`, `hud-muted`,
  `hud-text`, `hud-warn`).
- Contenitori: niente bordo pieno marcato; bordo sottile a bassa opacità più
  **staffe agli angoli** (alto-sinistra e basso-destra) in `hud-accent`;
  sfondo traslucido con `backdrop-filter: blur`.
- Etichette dei dati: monospace, maiuscole, spaziatura ampia, `hud-muted`.
  Valori: monospace.
- Gauge: traccia a filo sottile (2 px); tratto fino al valore illuminato
  (tranne la rampa spettrale); cursore a **barra verticale luminosa** al posto
  del pallino; tacche ed etichette come oggi.
- Le tile non hanno più un bordo proprio: le separa lo spazio.
- Solo font di sistema (stack attuali `--font-hud`, `--font-hud-mono`).
- Tutte le misure (spessori, raggi, durate) sono **scelte estetiche (non
  dato)** e lo dicono nel codice (AGENTS.md, Commenti 3).

### 2. Libreria di componenti (`ui/hud/`)

| Componente | Stato | Ruolo |
|---|---|---|
| `HudCard` | nuovo (sostituisce `HudPanel` e la classe `.hud-panel`) | contenitore con staffe e vetro, base di card e pannelli |
| `CardModeToggle` | nuovo | interruttore segmentato Base/Advanced (`aria-pressed`) |
| `CloseButton` | nuovo | il ✕ (oggi ripetuto in `StarPanel`, `SelectionOverlay`, `SystemOverlay`) |
| `DataRow` | nuovo | riga etichetta/valore con nota opzionale (oggi `Row` in `StarPanel` e tuple in `SystemOverlay`) |
| `DataSection` | nuovo | titolo di sezione ("Catalogo", "Archivio NASA"); sostituisce i `<details>` nelle card |
| `Tabs` | nuovo | `role="tablist"`, frecce ←/→, per il pannello del dock |
| `ToggleChip` | nuovo | pulsante acceso/spento (`aria-pressed`): classi spettrali |
| `HudSwitch` | nuovo (sostituisce `HudCheckbox`) | interruttore: checkbox nativa con `role="switch"`, aspetto custom |
| `HudSlider` | ridisegnato | `input range` nativo con `appearance: none` |
| `RangeSlider` | nuovo | due `input range` nativi sovrapposti; clic sul valore → campo numerico |
| `HudSelect` | ridisegnato | `select` nativo con `appearance: none` e freccia custom |
| `HudButton`, `Badge` | ridisegnati | stesso ruolo |
| `Gauge`, `StatTile` | ridisegnati | stesse scale; nuove varianti (§5) |
| `Dock` | ridisegnato | §6 |

Regola: ogni controllo custom tiene sotto l'elemento nativo (o il ruolo ARIA
equivalente), così tastiera, screen reader e test continuano a funzionare.

### 3. Galassia: card della stella

- **`StarPanel` eliminato.** La card che segue la stella diventa l'unica fonte
  dei dati della stella.
- **Base:** titolo, costellazione + classe spettrale, `CloseButton`,
  `CardModeToggle`, 4 tile (`StarStatTiles`), e — se la stella ha esopianeti —
  il pulsante "N pianeti noti · Vedi sistema →" (abilitato quando l'host è
  risolto, come oggi).
- **Advanced:** la card si allarga in orizzontale su due colonne. Sinistra: le
  4 tile. Destra:
  - magnitudine assoluta, indice di colore (B–V), età stimata (con "stima
    incerta", `n/d` se assente);
  - sezione **Catalogo**: ID catalogo, classe MS (`n/d`), variabile, multipla;
  - sezione **Archivio NASA** (solo host di esopianeti): metallicità, età,
    massa, log g, tipo spettrale, rotazione, v sin i.

  Il pulsante "Vedi sistema" in fondo. Tutti i campi di SPEC §6.6 restano
  presenti.
- **Animazione Base ↔ Advanced:** la card si allarga dal lato della linea di
  richiamo, poi la colonna destra entra in dissolvenza; il ritorno è
  l'inverso. Con `prefers-reduced-motion` il passaggio è immediato.
- **Bordi dello schermo:** la card cambia lato come oggi (`data-side`) e in
  più viene tenuta dentro l'**area utile**: il viewport meno la fascia in alto
  (ricerca, intestazione, aiuto e lingua), la fascia in basso (dock, barra
  del tempo) e, nella System View, i pannelli laterali. La colonna destra
  scorre se manca altezza. Il pannello del dock, quando aperto, sta sopra la
  card.
- **Chiusura:** ✕ o Esc deselezionano la stella (oggi la ✕ chiude solo la
  card e lascia il pannello).
- **Host non ancorati:** la selezione dalla ricerca chiama direttamente
  `enterSystemView(hostname)`.
- **Preferenza Base/Advanced:** una sola per stelle e pianeti, persistita in
  localStorage come lingua e player; default Base.
- **A11y:** la card resta una `section` con `aria-label`; il focus segue la
  regola attuale.

### 4. System View

- **Pannello sinistro (stella), fisso:**
  - intestazione: nome dell'host, badge "Non ancorato" se l'host non è nella
    nuvola (SPEC §10), classe spettrale;
  - host ancorato: 4 tile della stella + righe di catalogo (stesso contenuto
    della card Advanced);
  - host non ancorato: tile dai dati d'archivio (temperatura, luminosità,
    raggio); i dati assenti restano `n/d`;
  - in fondo: sezione **Archivio NASA**.

  Scorre se il contenuto non entra.
- **Pannello destro (pianeti), fisso:** solo l'elenco dei pianeti (una riga per
  pianeta con il tipo). Clic sulla riga = clic sul pianeta nella scena.
- **Selezione del pianeta (chiude #10):** clic sul pianeta o sulla riga →
  selezione; la camera vola sul pianeta e poi lo **segue**: a ogni frame il
  target dei controlli si sposta sulla posizione del pianeta e la camera
  trasla della stessa quantità, mantenendo distanza e angolo scelti
  dall'utente. ✕ o Esc chiudono la selezione; la camera smette di seguire e
  resta dov'è.
- **Card del pianeta:** stessa card della stella, ancorata al pianeta con
  anello e linea di richiamo; preferenza Base/Advanced condivisa.
  - **Base:** 4 tile (raggio, massa, periodo, temperatura di equilibrio — §5)
    + riga "Tipo".
  - **Advanced**, colonna destra: semiasse, eccentricità, inclinazione (con
    "orbita schematica" se assente), metodo e anno di scoperta, densità,
    insolazione, provenienza della massa, composizione (con nota di modello),
    senso dell'orbita.
- **Barra del tempo:** compatta, in basso al centro, su una riga (pausa,
  slider, valore, log); non si sovrappone ai pannelli laterali, che finiscono
  sopra di essa.
- **Dock:** schede Vista (tipi di pianeta, stile orbite, zona abitabile) e
  Opzioni.

### 5. Gauge

- **Magnitudine apparente:** asse invertito (20 a sinistra, −1 a destra:
  più a destra = più luminosa, come gli altri gauge). Zona **occhio nudo**
  (−1…6) come riquadro evidenziato con etichetta; zona **binocolo** (6…9) come
  tratto intermedio. Sotto il valore, verdetto a tre stati: "Visibile a occhio
  nudo" (≤ 6), "Visibile con un binocolo" (6 < m ≤ 9), "Serve un telescopio"
  (> 9). Soglia 6: esistente (`NAKED_EYE_AT`). Soglia 9: **convenzione
  approssimata** (dipende da strumento e cielo), documentata come tale.
- **Gauge del pianeta** (logaritmici; intervalli = scelta estetica, tacche =
  valori fisici):

  | Gauge | Intervallo | Tacche |
  |---|---|---|
  | Raggio | 0,3–30 R⊕ | Terra 1, Nettuno 3,883, Giove 11,209 (equatoriali, convenzione NASA Exoplanet Archive) |
  | Massa | 0,1–10⁴ M⊕ | Terra 1, Nettuno 17,15, Giove 317,83 |
  | Periodo orbitale | 0,1–10⁵ giorni | 1 giorno, 1 anno (365,25 giorni) |
  | Temperatura di equilibrio | 50–3000 K | Terra ≈ 255 K |

  La temperatura di equilibrio porta il verdetto "in zona abitabile:
  sì/no/n/d" dal dato `in_hz`. Nessuna zona abitabile disegnata sul gauge: il
  modello dell'app la definisce in distanza (√L), non in temperatura.
- Scale e tacche in `app/src/lib/gaugeScale.ts`; ogni costante riporta unità e
  natura (dato, convenzione, scelta estetica).

### 6. Dock

- Dock in basso al centro con icone ed etichette. Un pulsante apre il
  **pannello unico** sulla scheda corrispondente; cliccare il pulsante della
  scheda attiva, o Esc, lo chiude e riporta il focus al pulsante (come oggi).
- Il pannello ha le schede in alto (`Tabs`); si cambia sezione senza
  chiudere. Galassia: Filtri, Vista, Opzioni. System View: Vista, Opzioni.
- Galassia: il contatore delle stelle visibili passa dal badge sull'icona
  all'intestazione del pannello e al piede dei Filtri ("visibili / totali").
- Contenuti:
  - **Filtri:** classi spettrali come `ToggleChip` colorati (colore per
    classe: scelta estetica) + "?" per sconosciuta; distanza, magnitudine
    apparente e assoluta come `RangeSlider` con limiti dai dati reali
    (SPEC §13, come oggi); "Solo stelle: con esopianeti / multiple /
    variabili" come `HudSwitch`; "Reimposta" in intestazione.
  - **Vista:** nomi delle stelle, costellazioni come `HudSwitch`.
  - **Opzioni:** sezione Camera (velocità, orbita automatica), sezione Stelle
    (realismo, velocità e ampiezza dello scintillio disabilitate con il
    realismo, dimensione stelle); "Reimposta" in intestazione.
- Il pannello si apre sopra il dock e, nella System View, sopra la barra del
  tempo, che resta visibile.

### 7. Altri elementi

Ricerca (alto sinistra), aiuto e lingua (alto destra), player musicale (basso
destra), etichetta al passaggio del mouse, dialog di benvenuto e overlay di
caricamento restano dove sono e adottano i nuovi componenti. Le stringhe i18n
che citano il "pannello" (es. la riga del dialog di benvenuto sul pulsante
"Vedi sistema", `panel.close`) vengono aggiornate nelle 5 lingue.

## Casi limite ed errori

- **Dato assente:** gauge vuoto, valore `n/d`, nessun verdetto. Mai valori
  inventati (AGENTS.md, regola 5).
- **Valori limite** (`*lim`): mostrati con il simbolo di limite tramite
  `formatLimited`, come oggi.
- **Pianeti senza semiasse** (`pl_orbsmax` nullo): non sono disegnati
  (comportamento attuale). Restano nell'elenco; selezionandoli la card appare
  accanto al pannello destro senza anello, la camera non li segue, nota
  "posizione orbitale non disponibile".
- **Filtro per tipo:** se il filtro nasconde il pianeta selezionato, la
  selezione si chiude.
- **Oggetto fuori inquadratura:** la card si nasconde come fa oggi l'overlay e
  ricompare quando l'oggetto rientra.
- **localStorage non disponibile:** la preferenza Base/Advanced resta in
  memoria per la sessione (stesso comportamento delle altre preferenze).

## Test

- **Unit (Vitest, senza DOM):** nuove scale e tacche (`gaugeScale`), asse
  invertito della magnitudine; verdetto di visibilità alle soglie 6 e 9;
  persistenza della modalità Base/Advanced; calcolo dell'inseguimento della
  camera (offset mantenuto) in `lib/`; selezione del pianeta e chiusura per
  filtro nello store.
- **E2E (Playwright):** card Base e Advanced, con bounding box (nessuna
  sovrapposizione con dock, barra del tempo, pannelli laterali); toggle
  persistente dopo reload; "Vedi sistema" dalla card in Base; host non
  ancorato dalla ricerca → System View con badge; clic sul pianeta → card e
  camera che lo segue; schede del dock da tastiera; axe senza violazioni
  serious/critical.
- **`data-testid`:** quelli di `StarPanel` (`star-panel`, `panel-title`,
  `panel-close`, `planets-badge`, `view-system-button`, `star-advanced`, …)
  vengono rimossi o spostati sulla card; i test si aggiornano con il motivo
  (questa issue). Dati di test dalle golden fixture (SPEC §5.4).

## SPEC

Nessuna modifica necessaria: §6.6 e §6.7 elencano i campi, non dove vengono
mostrati, e tutti restano presenti. La modifica di §1 per il mobile appartiene
al secondo sottoprogetto.

## Acceptance criteria

1. Con una stella selezionata, nessun dato della stella compare in più di un
   punto dello schermo.
2. La card della stella passa da Base ad Advanced e viceversa con
   l'animazione descritta (immediata con reduced motion); la scelta resta
   dopo un reload.
3. In Advanced la card contiene tutti i campi di SPEC §6.6 e i dati
   d'archivio per gli host.
4. "Vedi sistema" è raggiungibile in Base con un clic.
5. Un host non ancorato selezionato dalla ricerca apre la System View con il
   badge "Non ancorato" e i dati della stella nel pannello sinistro.
6. Nella System View, cliccando un pianeta (nella scena o nell'elenco) la
   camera lo segue in orbita e la sua card mostra i dati di SPEC §6.7; ✕/Esc
   interrompono l'inseguimento.
7. A 1280×720 e 1920×1080 (bounding box): gli elementi fissi (ricerca,
   intestazione, pannelli laterali, barra del tempo, dock, pannello del dock)
   non si sovrappongono tra loro; la card resta dentro l'area utile (§3)
   anche per oggetti vicini ai bordi.
8. Il gauge della magnitudine apparente mostra asse invertito, zone e
   verdetto corretti per stelle sotto 6, tra 6 e 9 e sopra 9.
9. Il dock apre un pannello unico a schede, navigabile da tastiera; i filtri
   e le opzioni hanno lo stesso effetto di prima.
10. Tutti i controlli custom sono operabili da tastiera; axe senza violazioni
    serious/critical.
11. Gate completo verde (AGENTS.md).
