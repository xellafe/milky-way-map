# Issue #3 — UI sci-fi: design

- **Data:** 2026-09-30
- **Issue:** [xellafe/milky-way-map#3](https://github.com/xellafe/milky-way-map/issues/3) — "Enhance and upgrade UI"
- **Stato:** in revisione
- **Mockup:** `.superpowers/brainstorm/` (locale, non versionato)

## 1. Obiettivo

Rendere la UI più "sci-fi" e rivedere come vengono mostrati i dati, in quattro
parti (dalla issue):

1. tema sci-fi e componenti custom;
2. dettaglio stella migliorato;
3. overlay sulla stella selezionata;
4. gestione unificata di opzioni e filtri.

**Successo:** l'app ha un linguaggio visivo coerente (HUD olografico), la scena
è libera quando nessun pannello è aperto, i dati della stella si leggono a colpo
d'occhio, e restano validi i vincoli esistenti: nessun dato inventato
(AGENTS §5), `axe` senza violazioni serious/critical (M8), 60 FPS su 2,49M
stelle (M9), stringhe in 5 lingue, reduced-motion rispettato.

## 2. Decisioni visive (prese con i mockup)

| Parte | Scelta |
|---|---|
| Tema | **HUD olografico**: pannelli scuri semitrasparenti, bordo sottile, alone interno, numeri monospace |
| Palette | **Blu ghiaccio** `#9ec8ff` (accento), `#d6e8ff` (valori/titoli), `#8aa0c0` (etichette), `#f4f8ff` (testo); **arancio** `#ff9f5f` solo per stime e avvisi |
| Layout controlli | **Dock di icone in basso al centro** (Filtri, Vista, Opzioni); ogni icona apre il suo pannello sopra il dock; al massimo uno aperto. *Modifica approvata dall'umano dopo l'implementazione:* la musica sta nel gruppo in alto a destra, a sinistra del selettore lingua |
| Anello di selezione | **Doppio anello B6**: interno ≈ 40 px a tratto-punto con alone, esterno ≈ 54 px a puntini fini; ruotano in versi opposti (interno ~14 s/giro, esterno ~8 s/giro); animazione di **aggancio** alla selezione (arrivano larghi e si stringono in ~1 s) |
| Finestrella overlay | **I 4 valori in verticale** (distanza, temperatura, luminosità, magnitudine apparente), ognuno con la sua mini-scala; badge "N pianeti" solo se presenti. **Sempre visibile** (anche col pannello dettaglio aperto). Chiusura con una **x** in alto a destra e **effetto sfarfallio**; si riapre **cliccando di nuovo la stella**. Blocca il puntatore (decisione umana post-#3) |
| Dettaglio stella | **4 riquadri con indicatori grafici** (stessi 4 valori), poi elenco (magnitudine assoluta, B–V, età), poi "Altri dati e ID catalogo" richiudibile. Badge pianeti e pulsante "Vedi sistema" **solo** se la stella ha pianeti noti |

Motivo del cambio "pianeti" → "magnitudine apparente" nei riquadri: la grande
maggioranza delle stelle non ha pianeti noti, un riquadro sarebbe quasi sempre
"0" — e "0" suggerirebbe "non ha pianeti" invece di "nessun pianeta noto".

## 3. Architettura

**Approccio:** token nel tema Tailwind v4 + componenti React propri. Nessuna
dipendenza nuova (Tailwind è già nello stack).

### 3.1 Token (`app/src/index.css`, blocco `@theme`)

| Token | Valore |
|---|---|
| `--color-hud-accent` | `#9ec8ff` |
| `--color-hud-bright` | `#d6e8ff` |
| `--color-hud-muted` | `#8aa0c0` |
| `--color-hud-text` | `#f4f8ff` |
| `--color-hud-warn` | `#ff9f5f` |
| `--color-hud-bg` | `rgb(10 16 30 / 0.82)` |
| `--font-hud` | `'Segoe UI', system-ui, sans-serif` |
| `--font-hud-mono` | `Consolas, 'Cascadia Mono', ui-monospace, monospace` |

Font di sistema: nessun web font da scaricare.

### 3.2 Componenti base (`app/src/ui/hud/`)

Senza logica di dominio, tipati, piccoli:

| Componente | Responsabilità |
|---|---|
| `HudPanel` | contenitore HUD (bordo, alone), titolo opzionale |
| `HudButton` | pulsante primario/secondario |
| `HudCheckbox`, `HudSlider`, `HudSelect` | input **nativi** con stile HUD |
| `Gauge` | barra con marcatore da una posizione 0–1 (o nessun marcatore se `null`); varianti `track` e `spectral`; `ticks` opzionali (tacca + etichetta facoltativa; sostituisce `tick`/`tickLabel`; modifica approvata dall'umano) |
| `StatTile` | etichetta + valore + unità + badge "stima" opzionale + `Gauge` |
| `Badge` | etichetta compatta |
| `Dock`, `DockItem` | barra di icone, un pannello aperto per volta, Esc chiude e rimette il focus sull'icona |

### 3.3 Logica pura (`app/src/lib/gaugeScale.ts`)

Mappa un valore sulla posizione 0–1 della sua scala; `null` → `null`
(nessun marcatore, mai un valore inventato). Valori fuori scala → 0 o 1
(clamp).

| Funzione | Scala |
|---|---|
| `distanceScale(ly)` | logaritmica, 1 → 1000 a.l.; etichette 1 / 10 / 100 / 1.000 a.l. |
| `temperatureScale(K)` | banda spettrale M → O/B (≈ 2400 K → 30 000 K, log); etichette M K G F A B centrate nelle bande, tacche ai limiti MK approssimativi 3700 / 5200 / 6000 / 7500 / 10 000 K, O resta a destra (clamp) |
| `luminosityScale(Lsun)` | logaritmica, 0,001 → 1000 L☉ (Sole = 0,5); etichette 10⁻³ / 1 / 10³ |
| `magnitudeScale(mag)` | lineare, −1 → 20; etichette 0 e 20, tacca a 10 senza etichetta (scelta umana: l'etichetta collideva con "occhio nudo"); tacca "occhio nudo" a 6 |

Modifica approvata dall'umano: l'etichetta "Temperatura efficace" diventa "Temperatura" nelle 5 lingue (il campo dati in `SPEC.md` resta invariato).

### 3.4 Componenti di dominio

| Componente | Cambiamento |
|---|---|
| `StarPanel` | riscritto con `StatTile` ×4, elenco, "Altri dati" richiudibile, badge/pulsante pianeti condizionali |
| `SelectionOverlay` (nuovo) | anello B6 + finestrella; proiezione via `SelectionTracker` dentro il `Canvas` |
| `FiltersPanel`, `ViewTogglesPanel`, `OptionsPanel` | diventano contenuti dei pannelli del dock |
| `MusicControl` | fuori dal dock: sempre visibile in alto a destra, a sinistra del selettore lingua (modifica approvata dall'umano) |
| `SystemOverlay`, `SearchBox`, `LanguageSelector`, `HoverLabel`, `LoadingOverlay` | restyling HUD |

## 4. Flusso dei dati

### 4.1 Dock

- Stato locale "pannello aperto" (uno solo); clic sull'icona apre/chiude, Esc chiude.
- `<audio>` della musica **sempre montato**; play/pausa e volume sono sempre
  visibili in alto a destra (nessun pannello Musica nel dock).
- System View: il dock mostra solo Opzioni; la barra della scala temporale
  si posiziona sopra il dock.

### 4.2 Overlay di selezione

- `SelectionTracker` (componente r3f) proietta a ogni frame la posizione della
  stella selezionata e scrive `transform` sui nodi DOM via ref (stesso pattern
  di `StarLabels`): **nessuno stato React per frame**.
- Stella dietro la camera o fuori schermo → overlay nascosto.
- Se la finestrella non entra a destra (bordo schermo o pannello dettaglio), si
  posiziona a sinistra della stella.
- Store: nuovo `selectionOverlayOpen: boolean`; `selectStar(index)` lo imposta a
  `true` **a ogni** chiamata (anche sulla stessa stella → il clic riapre).
- La x avvia l'animazione di sfarfallio (CSS, ~350 ms, opacità irregolare), poi
  `closeSelectionOverlay()` imposta `false`. Reduced-motion: chiusura immediata.
- Host non agganciati (es. TRAPPIST-1): nessuna posizione → nessun overlay.
- Rientro dalla System View: l'overlay mantiene lo stato aperto/chiuso.

### 4.3 Dettaglio stella

Valori dallo store dei dettagli come oggi; ogni `StatTile` usa `gaugeScale`.
Dato `null` → "n/d" e scala vuota. Temperatura stimata → badge arancio "stima"
(come oggi "(stima approssimata)").

## 5. Fasi (una PR ciascuna)

| Fase | Contenuto | Esito visibile |
|---|---|---|
| **F1** | token, componenti base, restyling di tutti i pannelli **nella posizione attuale**; `STATE.md` (fix filtri in dev, PR #7); `.superpowers/` in `.gitignore` | stile HUD ovunque, layout invariato |
| **F2** | `Dock`; rimozione dei pannelli sparsi | scena libera, controlli unificati |
| **F3** | nuovo `StarPanel` | riquadri con indicatori |
| **F4** | `SelectionOverlay` | anello B6 + finestrella |

## 6. Accessibilità

- Contrasto testo ≥ 4,5:1 (WCAG AA), verificato da `axe`.
- Dock: `aria-label`, `aria-expanded`, `aria-controls`; Tab/Invio/Spazio; Esc
  chiude e rimette il focus sull'icona.
- `Gauge`: `role="meter"` con `aria-valuetext` (il valore è anche scritto accanto).
- x dell'overlay: `<button>` con `aria-label`, raggiungibile da tastiera.
- `prefers-reduced-motion`: niente rotazione, aggancio, sfarfallio.
- Stringhe nuove in EN/IT/ES/FR/DE.

## 7. Test

- **Vitest:** `gaugeScale` (estremi, clamp, `null`, log); store
  `selectionOverlayOpen` (apertura a ogni selezione, chiusura); stato del dock.
- **E2e per fase:** F1 suite esistente verde (i `data-testid` restano); F2 dock
  apre/chiude, Esc, controlli musica sempre visibili in alto a destra; F3 riquadri con i valori
  della fixture, nessun badge pianeti per stella senza pianeti; F4 overlay segue
  la stella, x chiude, clic riapre.
- `axe` su Galaxy e System View a ogni fase.
- FPS misurati dopo F4 (budget 60).

## 8. Fuori scope

- Nuovi dati o campi astronomici (si usano solo quelli già nel catalogo).
- Riorganizzazione della ricerca oltre al restyling.
- Temi alternativi / scelta del colore da parte dell'utente.
