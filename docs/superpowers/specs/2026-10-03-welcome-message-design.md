# Messaggio di benvenuto (issue #12) — design

## Obiettivo

All'apertura dell'app un dialog accoglie l'utente con una breve descrizione
di Galaxy Map e una guida rapida ai controlli. L'utente può disattivarlo
("Don't show again") e riaprirlo in qualsiasi momento con un pulsante "?".

## Stato attuale

- Nessun onboarding: i controlli della camera (WASD, R/F, Q/E, drag, rotella)
  sono documentati solo nel codice (`app/src/scene/CameraControls.tsx`).
- In alto a destra c'è il gruppo `MusicControl` + `LanguageSelector`, montato
  in `App.tsx` fuori dallo switch galaxy/system.
- `CameraControls` ignora i tasti solo se il target è un `input`/`textarea`.
- Le impostazioni utente sono in `localStorage` (`galaxy-map-settings`,
  `state/settings.ts`) e hanno un pulsante "Reset settings".
- Nessun `<dialog>` nell'app.

## Decisioni (con l'umano)

- Il dialog compare **a ogni visita**, finché l'utente non spunta "Don't show
  again".
- Un pulsante **"?"** in alto a destra lo riapre, in entrambe le viste.
- Compare **subito**, durante il caricamento del catalogo: la percentuale di
  `LoadingOverlay` resta visibile attraverso il backdrop semitrasparente, e il
  dialog si può chiudere anche prima che i dati siano pronti.
- Implementazione con `<dialog>` nativo e `showModal()`: focus trap, Esc,
  sfondo inerte e top layer li fornisce il browser.

## Contenuti

Testo sorgente in inglese, tradotto in it/es/fr/de.

- **Titolo:** Welcome to Galaxy Map
- **Descrizione:** mappa 3D del vicinato stellare intorno al Sole, costruita
  con dati reali dei cataloghi HYG e AT-HYG. Si esplorano le stelle e si entra
  nei sistemi che ospitano esopianeti per vederne le orbite in scala.
- **Guida rapida** (azione → comando):

| Azione | Comando |
|---|---|
| Guardarsi intorno / ruotare attorno alla stella selezionata | trascinare con il mouse |
| Muoversi | W A S D, R/F su/giù, Q/E rollio |
| Avvicinarsi o allontanarsi dalla stella selezionata | rotella |
| Selezionare una stella e volare fino a lei | click |
| Trovare una stella per nome o catalogo | casella di ricerca |
| Vedere il sistema planetario | pulsante "View system" nel pannello della stella |
| Filtri, opzioni di vista e impostazioni | barra in basso |

- **Footer:** checkbox "Don't show again", pulsante "Start exploring".

## Design

1. **Persistenza** — `app/src/lib/welcome.ts`:
   `isWelcomeDismissed(): boolean` e `setWelcomeDismissed(value: boolean)`
   su `localStorage['galaxy-map-welcome-dismissed']` (`'1'` = disattivato,
   chiave assente = attivo). Entrambe in try/catch: se `localStorage` non è
   disponibile il dialog compare e la scelta non viene salvata (SPEC §10:
   degrado senza errori). Il flag sta **fuori** da `Settings`, così
   "Reset settings" non lo tocca e `isDefaultSettings` non cambia.
2. **Stato** — `useGalaxyMapStore` riceve `welcomeOpen: boolean` (iniziale
   `!isWelcomeDismissed()`) e `setWelcomeOpen(open: boolean)`. Il dialog e il
   pulsante "?" leggono e scrivono solo da qui.
3. **`app/src/ui/WelcomeDialog.tsx`** — `<dialog>` con stile HUD (classi
   `hud-panel rounded-hud`), `aria-labelledby` sul titolo, montato in
   `App.tsx` fuori dallo switch delle viste.
   - Un effetto sincronizza `welcomeOpen` con `showModal()` / `close()`.
     L'evento `close` del dialog (Esc o pulsante) imposta `welcomeOpen=false`
     e salva lo stato della checkbox con `setWelcomeDismissed`.
   - La checkbox parte dal valore salvato a ogni apertura: riaprendo con "?"
     l'utente vede la spunta e può toglierla.
   - Guida come `<dl>`; i tasti sono `<kbd>`.
   - Altezza massima entro il viewport con scroll interno: il dialog non
     esce mai dallo schermo.
   - Backdrop (`::backdrop`) nero semitrasparente, CSS in
     `@layer components` di `index.css`.
4. **`app/src/ui/HelpButton.tsx`** — `HudButton` "?" con `aria-label`
   tradotto, `data-testid="help-button"`; primo elemento del gruppo in alto a
   destra in `App.tsx`. Al click: `setWelcomeOpen(true)`.
5. **`CameraControls`** — la guardia di `onKeyDown` ignora anche i tasti il
   cui target sta dentro un `<dialog>` (`closest('dialog')`): con il dialog
   aperto WASD non muove la camera.
6. **i18n** — chiavi `welcome.*` (titolo, descrizione, etichette della guida,
   checkbox, pulsante di chiusura, `aria-label` del pulsante "?") in
   en/it/es/fr/de.

Il click su "Start exploring" conta come primo gesto per l'autoplay della
musica (`MusicControl`): comportamento già esistente, invariato.

Nessuna dipendenza nuova, SPEC invariata.

## Test

- **Unit** `lib/welcome.ts`: chiave assente → non disattivato; set/get
  round-trip `true`/`false`; `localStorage` che lancia un'eccezione →
  `isWelcomeDismissed()` restituisce `false` e `setWelcomeDismissed` non
  lancia.
- **E2e** `welcome.spec.ts` (`data-testid`: `welcome-dialog`,
  `welcome-dont-show`, `welcome-start`, `help-button`):
  - il dialog è visibile al primo caricamento, anche prima di `dataStatus`
    `ready`;
  - "Start exploring" e Esc lo chiudono;
  - con "Don't show again" spuntato non ricompare dopo il reload; senza
    spunta ricompare;
  - "?" lo riapre in Galaxy View e in System View;
  - con il dialog aperto, tenere premuto W non sposta la camera;
  - bounding box del dialog interamente dentro il viewport;
  - `axe` sul dialog aperto senza violazioni serious/critical.
- **Spec e2e esistenti**: `playwright.config.ts` imposta il flag via
  `use.storageState` (origin `http://localhost:4173`), così i 19 spec attuali
  non vedono il dialog. `welcome.spec.ts` lo azzera con
  `test.use({ storageState: { cookies: [], origins: [] } })`.

## Acceptance

- AC1: alla prima visita il dialog compare subito, con titolo, descrizione e
  guida nella lingua attiva (5 lingue).
- AC2: Esc e "Start exploring" chiudono il dialog; con "Don't show again" il
  dialog non compare alle visite successive.
- AC3: il pulsante "?" riapre il dialog in entrambe le viste, con la checkbox
  allineata al valore salvato.
- AC4: con il dialog aperto i tasti di movimento non agiscono sulla camera.
- AC5: dialog dentro il viewport; `axe` senza violazioni serious/critical.
- AC6: gate completo verde.
