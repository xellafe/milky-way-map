# Music player in basso a destra (issue #13) — design

## Obiettivo

I controlli della musica di sottofondo diventano un player HUD dedicato,
ancorato all'angolo in basso a destra, visibile in Galaxy e System View:
playlist con prev/next, play/pausa, volume, titolo del brano corrente,
riducibile a icona.

## Stato attuale

- `app/src/ui/MusicControl.tsx`: play/pausa + slider volume in un `HudPanel`,
  nel gruppo in alto a destra di `App.tsx` (accanto a "?" e lingua), fuori
  dallo switch delle viste. Hook `useMusic`: `<audio loop>`, volume iniziale
  0.4, autoplay al mount o al primo gesto fuori da `[data-music-zone]`.
- Un solo brano: `app/src/assets/background-music.mp3` (Federico Xella, tutti
  i diritti riservati, `NOTICE.md` §4).
- Pannelli di destra (`StarPanel`, pannello pianeta di `SystemOverlay`):
  `top-16 right-4 max-h-[calc(100%-5rem)]`, arrivano a 1rem dal fondo.
- Dock (`ui/hud/Dock.tsx`): `bottom-4` centrata; il pannello aperto sta in una
  fascia centrata `bottom-20`, `max-w-md`. Stato `dockPanel` nello store.
- System View: barra della velocità del tempo nella stessa fascia `bottom-20`,
  nascosta quando un pannello della dock è aperto.
- `SelectionTracker` tiene la card di selezione tra la search box e il bordo
  superiore della dock (`[data-hud=dock]`).
- `lib/welcome.ts` legge/scrive un flag in `localStorage` con try/catch.
- E2e `music.spec.ts`: toggle play/pausa e volume (`music-control`,
  `music-toggle`, `music-volume`, `music-audio`).

## Decisioni (con l'umano)

- **Playlist di un solo brano** per ora; il player è pronto per più tracce.
  Con un brano solo prev/next lo riportano all'inizio.
- **Titolo:** ~~"Colonna sonora di Galaxy Map", tradotto (chiave i18n)~~.
  **Modificato (decisione umana, 2026-10-05, dopo l'implementazione):** la
  playlist si legge a build time da `app/src/assets/musics/`
  (`import.meta.glob`; mp3/m4a/ogg), in ordine di nome numeric-aware; titolo =
  nome file senza estensione né numero iniziale + separatore (`01 - `, `01_`,
  `01.`, `1 `), `_` → spazio, non tradotto. Cartella vuota = nessun player.
  Limite: ogni numero iniziale seguito da un separatore è tolto
  ("2001 Space Odyssey.mp3" → "Space Odyssey"). Il brano è ora
  `musics/01 - Colonna sonora di Galaxy Map.mp3`; `NOTICE.md` §4 copre l'intera
  cartella. Dove sotto si parla di titolo tradotto, `PLAYLIST` in
  `MusicPlayer.tsx` o `music.tracks.soundtrack`, vale questa decisione.
- **Avvio:** espanso; lo stato espanso/ridotto è ricordato tra le visite.
- **Pannelli di destra:** si accorciano e terminano sopra il player.
- **Modalità compatta** (viewport < 1024 px, breakpoint `lg`): il player
  espanso si alza sopra la dock; player espanso e pannello della dock si
  escludono a vicenda. Soglia ricavata dalle larghezze reali: con il player
  largo 16rem la dock lo tocca sotto ~690 px, un pannello della dock aperto
  sotto ~990 px.
- Approccio: evolvere `MusicControl` in `MusicPlayer` (nessuna dipendenza
  nuova).

## Design

1. **`app/src/lib/localFlag.ts`** — `readFlag(key: string): boolean` (`true`
   solo se il valore è `'1'`) e `writeFlag(key: string, value: boolean): void`
   (`true` → `setItem(key, '1')`, `false` → `removeItem(key)`), con try/catch
   (SPEC §10). `lib/welcome.ts` li riusa: interfaccia e comportamento di
   `isWelcomeDismissed`/`setWelcomeDismissed` invariati.
2. **`app/src/lib/playlist.ts`** — `interface Track { src: string; titleKey: string }`,
   `nextIndex(index: number, length: number): number` e
   `prevIndex(index: number, length: number): number` con giro agli estremi
   (`nextIndex(n-1, n) = 0`, `prevIndex(0, n) = n-1`). La lista `PLAYLIST`
   sta in `ui/MusicPlayer.tsx` (importa l'asset mp3): un elemento,
   `{ src: musicUrl, titleKey: 'music.tracks.soundtrack' }`.
3. **`app/src/lib/viewport.ts`** — `COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)'`
   e `isCompactViewport(): boolean` (`matchMedia`, `false` se `window` non
   esiste, così Vitest senza DOM funziona).
4. **Store** — `musicExpanded: boolean` (iniziale
   `!readFlag('galaxy-map-music-collapsed')`) e
   `setMusicExpanded(expanded: boolean)`, che salva il flag
   (`writeFlag(key, !expanded)`) e, se `expanded && isCompactViewport()`,
   chiude il pannello della dock. `toggleDockPanel`, quando apre un pannello
   in modalità compatta, riduce il player (`musicExpanded=false`, flag
   salvato).
5. **`app/src/ui/MusicPlayer.tsx`** (sostituisce `MusicControl.tsx`) —
   montato in `App.tsx` fuori dallo switch delle viste, `absolute bottom-4
   right-4 z-20`, `data-hud="music-player"`, `data-music-zone`,
   `data-testid="music-control"`.
   - **Espanso** (`w-64`): titolo del brano (`music-title`, troncato con
     ellissi); riga con prev (`music-prev`), play/pausa (`music-toggle`), next
     (`music-next`), volume (`music-volume`), riduci (`music-collapse`).
   - **Ridotto:** solo il pulsante ♪ (`music-expand`), `aria-expanded=false`;
     il pulsante "riduci" ha `aria-expanded=true`. Entrambi con
     `aria-controls` sul contenitore dei controlli.
   - In modalità compatta il player espanso sta a `bottom-20` (sopra la dock),
     `max-w-[calc(100%-2rem)]`; ridotto resta a `bottom-4`.
   - L'`<audio>` è sempre montato (anche da ridotto): ridurre/espandere non
     interrompe la riproduzione.
6. **`useMusic`** — gestisce `trackIndex`. Prev/next: se l'indice risultante
   è uguale a quello corrente (playlist di un brano) riporta `currentTime` a
   0; altrimenti cambia `src`. In entrambi i casi, se stava suonando continua
   a suonare. Niente attributo `loop`: su `ended` scatta next (con un brano
   solo riparte da capo). Volume iniziale 0.4 e autoplay al primo gesto
   invariati.
7. **Pannelli di destra** — `StarPanel` e pannello pianeta di `SystemOverlay`
   riservano la fascia del player: `max-h` che termina sopra il player
   espanso più un margine. Due valori, perché in modalità compatta il player
   è rialzato: uno sotto `lg` (sopra il player a `bottom-20`) e uno da `lg`
   in su (sopra il player a `bottom-4`); scelte estetiche, non dati, con
   commento.
8. **Barra del tempo (System View)** — nascosta anche quando
   `musicExpanded && isCompactViewport()` (stessa fascia `bottom-20`).
9. **`SelectionTracker`** — limite inferiore della card = il bordo superiore
   più alto tra `[data-hud=dock]` e `[data-hud=music-player]`.
10. **App.tsx** — il gruppo in alto a destra resta con `HelpButton` e
    `LanguageSelector`.
11. **i18n** — nuove chiavi `music.prev`, `music.next`, `music.collapse`,
    `music.expand`, `music.nowPlaying` (etichetta del titolo per screen
    reader), `music.tracks.soundtrack` ("Galaxy Map soundtrack" /
    "Colonna sonora di Galaxy Map") in en/it/es/fr/de. Restano `music.label`,
    `music.play`, `music.pause`, `music.volume`.
12. **Documenti** — `README.md` (feature), `STATE.md` a fine issue. Nessuna
    fonte nuova: `NOTICE.md` invariato.

## Test

- **Unit** `localFlag`: chiave assente → `false`; round-trip; `localStorage`
  che lancia o assente → `false` senza eccezioni. `welcome.test.ts` resta
  verde senza modifiche.
- **Unit** `playlist`: `nextIndex`/`prevIndex` con n=1 (sempre 0), n=3 (giro
  agli estremi in entrambe le direzioni).
- **Unit** store: `setMusicExpanded` salva il flag; in modalità compatta
  (stub di `matchMedia`) espandere chiude `dockPanel` e aprire un pannello
  della dock riduce il player; fuori dalla modalità compatta non si
  influenzano.
- **E2e** `music.spec.ts` (test esistente aggiornato, non rimosso):
  - toggle play/pausa e volume (come oggi);
  - next e prev con il brano in riproduzione: `currentTime` torna vicino a 0
    e l'audio resta in riproduzione;
  - riduci → `music-expand` visibile, audio ancora in riproduzione; espandi →
    controlli di nuovo visibili;
  - ridotto + reload → resta ridotto;
  - titolo "Galaxy Map soundtrack" (en) e "Colonna sonora di Galaxy Map"
    (`locale: 'it-IT'`);
  - il player resta visibile e in riproduzione entrando nella System View;
  - bounding box a 1280×720: player nell'angolo in basso a destra, nessuna
    intersezione con dock, pannello della dock aperto, pannello stella (stella
    selezionata via ricerca), card di selezione;
  - bounding box a 375×812: player espanso sopra la dock senza intersezioni;
    aprendo un pannello della dock il player si riduce, espandendolo il
    pannello si chiude; nella System View la barra del tempo è nascosta con
    il player espanso;
  - `axe` sul player espanso e ridotto senza violazioni serious/critical;
  - navigazione da tastiera: Tab raggiunge tutti i controlli del player.

## Acceptance

- AC1: player in basso a destra in entrambe le viste; la riproduzione
  sopravvive al cambio di vista.
- AC2: prev/next scorrono la playlist con giro agli estremi (con un brano lo
  riportano a 0:00); play/pausa e volume funzionano; titolo tradotto.
- AC3: riduci/espandi non interrompono la riproduzione; lo stato è ricordato
  tra le visite.
- AC4: nessuna sovrapposizione con dock, pannelli della dock, pannelli di
  destra, card di selezione, barra del tempo a 1280×720 e 375×812.
- AC5: autoplay al primo gesto invariato; accessibile da tastiera, `axe`
  senza violazioni serious/critical; stringhe in 5 lingue.
- AC6: test `music-*` aggiornati, non rimossi; gate completo verde.
