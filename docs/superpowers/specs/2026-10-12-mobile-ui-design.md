# Interfaccia mobile (issue #25) — design

- **Issue:** [xellafe/milky-way-map#25](https://github.com/xellafe/milky-way-map/issues/25) — "Mobile interface", secondo sottoprogetto di #23.
- **Prerequisito:** modifica di SPEC §1 e §7 approvata dall'umano (sezione 1 di questo documento).

## Obiettivo

Rendere Galaxy Map usabile su un telefono da **un curioso che vuole esplorare
le stelle vicine**: gira tra le stelle con le dita, ne tocca una, legge cosa
c'è da sapere ed entra nei sistemi con esopianeti. Le opzioni avanzate restano
raggiungibili, ma non sono il caso d'uso principale.

**Criterio di successo dell'umano:** la scena resta protagonista. Nessun
pannello copre tutta la scena e nessun elemento della UI esce dai margini.

**Anti-goal (fallimento anche se "funziona"):**
- pannelli che coprono la scena intera, o più pannelli aperti insieme;
- UI tagliata o fuori schermo, in verticale o in orizzontale;
- desktop peggiorato: mouse, rotella, tastiera e layout desktop restano identici.

**Fuori perimetro:** tablet (usano il layout desktop), joystick o pulsanti di
movimento a schermo, pan a due dita, issue #8 e #9.

## Stato attuale

- **Camera galassia** (`scene/CameraControls.tsx`): controller custom. Il drag
  con un dito funziona già (touch = `button 0`); con due dita i puntatori
  scrivono lo stesso `last` e la vista salta. La rotella zooma solo con una
  stella selezionata; il movimento libero è solo WASD/R/F, rollio Q/E. Nessun
  `touch-action` sul canvas.
- **Camera System View** (`scene/SystemScene.tsx`): drei `OrbitControls`; un
  dito ruota e il pinch zooma già, pan disattivato.
- **Picking** (`scene/StarPicking.tsx`): il tap seleziona già (pointerup,
  movimento < 5 px). Raggio minimo `PICK_MIN_PX = 7`, troppo piccolo per un
  dito. `HoverLabel` su touch non compare mai.
- **Layout:** larghezze fisse (ricerca 320 px, barra del tempo 448 px, pannelli
  System View 288 px, card Advanced 470 px). Unico breakpoint `lg:` in
  `MusicPlayer.tsx` e `sidePanel.ts`. `scene/usableArea.ts` misura gli elementi
  `data-hud` e assume pannelli affiancati. A 375 px la ricerca si sovrappone ai
  bottoni in alto a destra e i pannelli coprono la scena.
- **Guida di benvenuto:** comandi solo mouse/tastiera (`welcome.guide.*`).
- **Performance:** nessun LOD; il Canvas della galassia non fissa `dpr`.
- **E2E:** un solo progetto Playwright `Desktop Chrome`; a 375×812 c'è solo
  `music.spec.ts`.

---

## 1. Modifica di SPEC (da approvare prima dell'implementazione)

**§1 Overview:** "web app desktop" → "web app per desktop e telefono".

**§1 Non-Goals:** la riga "❌ Nessun supporto mobile/touch in v1 (solo
desktop web)" diventa:

> ❌ Nessun layout dedicato ai tablet: usano il layout desktop (i gesti touch
> funzionano comunque). Telefoni supportati in verticale e in orizzontale;
> viewport minimo 360 × 640 (in orizzontale 640 × 360).

**§7 Budget:** aggiungere

> **30 FPS** stabili su telefono Android di fascia media, nuvola completa e
> System View. `[Non verificato — da misurare su dispositivo reale]`

## 2. Quando si attiva il layout mobile

Layout mobile se **puntatore principale touch** (`(pointer: coarse)`) **e lato
corto della finestra < 600 px**. Così cadono dentro i telefoni in entrambe le
orientazioni e restano fuori tablet e desktop (anche desktop con touchscreen e
mouse come puntatore principale).

- Orientazione: **verticale** se altezza ≥ larghezza, altrimenti **orizzontale**.
- Il valore si ricalcola a resize e rotazione, senza ricaricare la pagina.
- La logica è una funzione pura in `lib/` (input: larghezza, altezza, coarse;
  output: `desktop | portrait | landscape`) con unit test; un hook la collega a
  `matchMedia`/resize.
- 600 px è una **scelta progettuale**, non un dato: commentarla così.

## 3. Gesti touch

Valgono su qualsiasi dispositivo touch, non solo nel layout mobile. Mouse e
tastiera non cambiano.

**Galassia, nessuna stella selezionata**
- Un dito trascina → ruota lo sguardo (come il drag del mouse oggi).
- Pinch → avanza o arretra lungo la direzione di vista (equivale a W/S). È
  l'unico spostamento su touch. Velocità coerente con quella di W/S e con
  l'impostazione di velocità di movimento esistente.

**Galassia, stella selezionata**
- Un dito → orbita attorno alla stella (come oggi).
- Pinch → avvicina/allontana dalla stella, con gli stessi limiti della rotella.
- Tap su un'altra stella → selezione e volo (come oggi).

**System View**
- Invariata: `OrbitControls` gestisce già un dito (rotazione) e pinch (zoom).
- Tap su un pianeta → selezione e follow (come oggi).

**Regole comuni**
- Il canvas ha `touch-action: none`, per evitare scroll e zoom del browser.
- Con due dita il controller non deve più far saltare la vista: traccia i
  puntatori attivi per `pointerId`. Il passaggio da due dita a una non deve
  produrre uno scatto.
- Durante il volo verso una stella l'input è ignorato (come oggi).
- **Area di tocco:** con puntatore coarse il raggio minimo di picking passa da
  7 px a un valore adatto al dito (indicativo 20-24 px CSS; scelta progettuale).
- **Hover:** su touch `HoverLabel` non c'è; il tap apre direttamente il pannello.
- **Tap nel vuoto** nella galassia: comportamento invariato (la selezione resta;
  si chiude con ✕).

## 4. Layout mobile: un unico pannello

Principio: **un solo pannello aperto per volta**. Aprirne uno chiude il
precedente. La scena resta visibile sopra (verticale) o accanto (orizzontale).

### 4.1 Contenitore

- **Verticale:** pannello dal basso, a tutta larghezza, con maniglia. Tre
  altezze: chiuso (solo maniglia, o nascosto se non c'è nulla da mostrare),
  **base** (indicativo ~40% dell'altezza) ed **espanso** (indicativo ~85%,
  contenuto scorrevole). La maniglia si trascina; un tap sulla maniglia
  alterna base ed espanso.
- **Orizzontale:** lo stesso pannello entra da destra, a tutta altezza, largo
  al massimo metà della finestra. Base ed espanso differiscono per larghezza o
  sono un solo stato: scelta del builder, purché la scena resti visibile per
  almeno metà larghezza. Barra in alto (ricerca, aiuto, lingua) e barra del
  dock (orizzontale, in basso) occupano solo l'area della scena, a sinistra
  del pannello.
- Rispetta le safe area (`env(safe-area-inset-*)`) e usa `dvh`.
- Mai fuori dai margini: nessun contenuto oltre i bordi del viewport, in
  nessuna orientazione, da 360 × 640 in su.

### 4.2 Contenuti del pannello

| Contesto | Stato base | Espanso |
|---|---|---|
| Stella selezionata (galassia) | card Base: nome, ✕, dati principali, "Vedi sistema" | modalità Advanced |
| System View, nessun pianeta | schede **Stella** e **Pianeti (N)** (ex pannelli laterali) | dati completi della scheda attiva |
| System View, pianeta selezionato | card pianeta Base, "‹" torna alla lista, ✕ deseleziona | modalità Advanced |
| Dock | schede del dock (Filtri, Vista, Opzioni, come su desktop) | — |

- Su mobile il toggle Base/Advanced della card è sostituito dalle altezze del
  pannello (base = Base, espanso = Advanced).
- La card della stella **non** è più ancorata alla stella su mobile.
- La camera inquadra l'oggetto selezionato nell'area libera sopra il pannello
  (verticale) o alla sua sinistra (orizzontale). `usableArea.ts` va esteso o
  affiancato perché conosca il pannello mobile; lo shift del follow del
  pianeta (`setViewOffset`) segue la stessa area.

### 4.3 Elementi fissi

- **In alto:** a sinistra la ricerca come **icona**, che al tocco si allarga a
  tutta riga (la tastiera virtuale non deve coprire i risultati); nella System
  View al suo posto c'è l'header "← Galassia · nome". A destra aiuto e lingua.
- **In basso:** la barra dei bottoni del dock (in orizzontale, in basso
  nell'area della scena). Barra del tempo (solo System View, come oggi) e
  player musicale diventano bottoni del dock che aprono il loro contenuto nel
  pannello unico.
- **Dock e card nel pannello** (dai mockup approvati): in verticale la card
  della stella o del pianeta copre la barra del dock finché è aperta; il
  pannello del dock aperto mostra i bottoni del dock in fondo al pannello.

### 4.4 Passaggi tra contenuti del pannello

- Aprire il dock con una selezione attiva nasconde la card ma **non**
  deseleziona; chiudendo il dock la card torna in stato base.
- ✕ sulla card deseleziona (come oggi); trascinare il pannello fino a chiuderlo
  lascia la selezione e mostra la sola maniglia, da cui la card si riapre.
- Entrando nella System View il pannello si apre in stato base sulla scheda
  Stella (come nel mockup); si può abbassare fino alla maniglia.
- La modalità Base/Advanced su mobile non scrive il flag persistito della card
  (`CARD_ADVANCED_KEY`): il desktop resta invariato.
- Il modello di stato (stato "pannello attivo" derivato da quello esistente o
  nuovo) è scelta del builder, purché la logica desktop non cambi.
- Target touch: almeno 44 × 44 px CSS per bottoni e controlli interattivi.

### 4.5 Guida di benvenuto e aiuto

Su touch la guida mostra i comandi touch (trascina con un dito, pinch, tap),
non mouse e tastiera. Nuove chiavi i18n in tutte e cinque le lingue. Il
dialogo resta entro il viewport in entrambe le orientazioni.

## 5. Performance

Obiettivo: 30 FPS su Android di fascia media (verifica dell'umano su
dispositivo reale, annotata in `STATE.md`).

Leve:
1. `dpr` del Canvas limitato su mobile (indicativo `[1, 1.5]`): nel piano.
2. Scintillio spento su mobile: nel piano.
3. Meno stelle disegnate (`setDrawRange`): **fuori dal piano**. Il piano
   termina con un `[CHECKPOINT]` per la misura dell'umano sul telefono; solo
   se resta sotto i 30 FPS si apre un seguito, verificando prima che i buffer
   siano ordinati per luminosità (altrimenti tocca pipeline o caricamento).

## 6. Test e acceptance criteria

**E2E:** nuovo progetto Playwright mobile (Chromium con `hasTouch` e
`isMobile`), viewport 375 × 812 e 812 × 375. Il progetto desktop resta
invariato e verde.

**AC**
1. SPEC §1 e §7 aggiornati con approvazione umana.
2. La funzione di layout restituisce `desktop | portrait | landscape` secondo
   la sezione 2 (unit test, inclusi 360×640, 640×360, 768×1024 coarse →
   desktop, 1280×720 fine → desktop).
3. Pinch nella galassia senza selezione sposta la camera lungo la vista; con
   stella selezionata cambia la distanza dalla stella entro i limiti della
   rotella; due dita non fanno saltare la vista (unit test della logica in
   `lib/`, e2e con touch emulato).
4. Tap su una stella apre il pannello in stato base con nome e "Vedi sistema".
5. In verticale e in orizzontale nessun elemento della UI esce dal viewport
   (bounding box), con pannello chiuso, base ed espanso, nella galassia e nella
   System View.
6. Mai più di un pannello aperto: aprire il dock chiude la card e viceversa.
7. Con il pannello in stato base la stella o il pianeta selezionato resta
   visibile nell'area libera (bounding box del pannello vs proiezione
   dell'oggetto).
8. La ricerca aperta occupa la riga in alto senza sovrapporsi ad aiuto e lingua.
9. Bottoni interattivi del layout mobile ≥ 44 × 44 px.
10. Guida di benvenuto con comandi touch su dispositivo touch, stringhe in
    `en/it/es/fr/de`.
11. `axe` senza violazioni serious/critical su entrambe le viewport mobile.
12. Desktop invariato: suite e2e desktop esistente verde senza modifiche ai
    test, salvo motivazione esplicita.
13. 30 FPS su Android di fascia media: verifica umana, esito in `STATE.md`.

## 7. Decisioni dell'umano

- Utente tipo: un curioso che esplora le stelle vicine.
- Gesti: pinch per lo zoom, un dito per ruotare; pinch nella vista libera
  avanza/arretra lungo la direzione di vista.
- Card come pannello dal basso (opzione A dei mockup) e un unico pannello per
  stella, System View, pianeta e dock.
- Telefoni in verticale e orizzontale; niente tablet.
- 30 FPS su Android di fascia media bastano.

## 8. Scelte lasciate al builder o fatte dal controller

Marcate come scelte, non come richieste dell'umano:
- soglia 600 px sul lato corto e condizione `pointer: coarse` (controller);
- in orizzontale il pannello entra da destra, max metà larghezza (controller);
- pan a due dita escluso (controller, confermato dall'umano nel riepilogo);
- in orizzontale barra in alto e dock solo sull'area della scena; dock nascosto
  sotto la card; passaggi tra contenuti del pannello (§4.4); flag Advanced non
  persistito su mobile; leva 3 della performance fuori dal piano (controller);
- raggio di picking touch, altezze del pannello, `dpr`: valori indicativi,
  da tarare;
- struttura dei componenti (un componente pannello riusato dai contenuti
  esistenti, o adattamento dei componenti attuali): builder.
