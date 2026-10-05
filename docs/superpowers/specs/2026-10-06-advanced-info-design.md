# Informazioni avanzate su stelle e pianeti (issue #18) — design

## Obiettivo

Mostrare dati avanzati sulle stelle che ospitano pianeti e sui pianeti, solo
quando il catalogo li fornisce, più una composizione indicativa del pianeta
ricavata da massa e raggio misurati ed etichettata come modello approssimato.

## Richiesta e fattibilità

La issue chiede: stelle → metallicità, composizione, cicli solari; pianeti →
composizione, asse, verso di rotazione. Fonte: NASA Exoplanet Archive,
`pscomppars` (6375 pianeti al 2026-10-05; copertura misurata con TAP):

| Richiesta | Dato | Copertura | Esito |
|---|---|---|---|
| Metallicità stella | `st_met` ([Fe/H] o [M/H], `st_metratio`) | 5725 | mostrata |
| Composizione stella | nessuno (la metallicità è l'unico indicatore) | — | non mostrata |
| Cicli solari | nessuno; solo `st_rotp` (933) e `st_vsin` (2361) | — | rotazione mostrata, cicli no |
| Composizione pianeta | `pl_dens` (6230) + massa/raggio | 2467 con massa misurata | densità + composizione indicativa |
| Asse del pianeta | sconosciuto per tutti gli esopianeti | — | non mostrato |
| Verso di rotazione del pianeta | sconosciuto; solo obliquità spin-orbita `pl_projobliq` (242) / `pl_trueobliq` (75) | 242 | orbita prograda/retrograda rispetto alla rotazione della stella |

Altri dati reali aggiunti: `st_age` (4921), `st_mass`, `st_logg`,
`st_spectype` (2400), `pl_insol` (5783), `pl_bmassprov` (provenienza della
massa: `Mass` 2467, `Msini` 926, `M-R relationship` 2967, `Msin(i)/sin(i)` 15).

Le stelle senza pianeti (AT-HYG) non hanno questi dati: nessuna modifica per
loro.

## Decisioni (con l'umano)

- **Perimetro B:** solo dati reali + composizione indicativa del pianeta dalla
  relazione massa-raggio, etichettata "modello approssimato", solo con massa
  misurata (`pl_bmassprov = 'Mass'`). Voci senza dato non compaiono.
- **Posizione A:** sezioni espandibili "Dati avanzati" (`<details>`, chiuse di
  default) nel pannello stella in galassia (solo stelle ospiti, ancorate e
  non) e nel pannello pianeta della System View.
- **Composizione A:** confronto con le curve massa-raggio teoriche di Zeng et
  al. (vedi §3), non soglie fisse di densità.
- **Approccio 1:** nuove colonne nella pipeline esistente
  (`fetch_exoplanets.py` → `crossmatch.py` → `exoplanets.json`); niente file
  separato, niente query a runtime.

## Design

1. **Pipeline** (`data-pipeline/`):
   - `fetch_exoplanets.py` `COLUMNS` aggiunge: `st_met`, `st_metlim`,
     `st_metratio`, `st_age`, `st_agelim`, `st_mass`, `st_masslim`, `st_logg`,
     `st_logglim`, `st_spectype`, `st_rotp`, `st_rotplim`, `st_vsin`,
     `st_vsinlim`, `pl_dens`, `pl_denslim`, `pl_insol`, `pl_insollim`,
     `pl_bmassprov`, `pl_projobliq`, `pl_projobliqlim`, `pl_trueobliq`,
     `pl_trueobliqlim`.
   - `crossmatch.py`: le colonne `st_*` entrano in `HOST_STAR_FIELDS` (stessa
     regola "primo valore non nullo" per host) e nell'oggetto host di output;
     le `pl_*` in `PLANET_FIELDS`. Un valore e il suo flag `*lim` vanno presi
     **dalla stessa riga** (mai valore da una riga e flag da un'altra).
   - Convenzione dei flag (NASA Exoplanet Archive): `lim = 1` limite superiore
     ("<"), `lim = -1` limite inferiore (">"), `0`/`null` misura. La pipeline
     li conserva tali e quali.
   - Fixture: `make_fixtures.py` rigenerate dai dati reali (TRAPPIST-1, Proxima
     Cen), mai scritte a mano; pytest su: presenza delle colonne, accoppiamento
     valore/flag dalla stessa riga, `null` preservato.
   - `data-pipeline/README.md` aggiornato (colonne, flag).
2. **Tipi e caricamento** (`app/src/data/exoplanets.ts`): i nuovi campi sono
   opzionali nel JSON e normalizzati a `null` al caricamento, così l'app
   funziona anche con un `exoplanets.json` di produzione generato prima del
   prossimo data-refresh (campi assenti → "n/d").
3. **Composizione** (`app/src/lib/planetComposition.ts`):
   `planetComposition(massEarth: number | null, radiusEarth: number | null, massProv: string | null): 'rocky' | 'water' | 'gaseous' | null`.
   - `null` se `massProv !== 'Mass'`, se massa o raggio mancano o non sono
     finiti/positivi.
   - Curve: composizione terrestre (rocciosa, ~32.5% ferro) e 50% acqua
     (H₂O), dalle tabelle massa-raggio pubblicate da Zeng et al. 2019 (PNAS
     116, 9723) — punti copiati dalla tabella pubblicata, mai stimati,
     interpolati in log-log; fuori dal range della tabella si estrapola
     dal segmento finale (semplificazione deliberata, dichiarata nel codice).
   - Regola: `R ≤ R_rock(M)` → `rocky`; `R_rock(M) < R ≤ R_water50(M)` →
     `water`; `R > R_water50(M)` → `gaseous`.
   - Citazione nel codice e in `NOTICE.md` (modello, non dato).
4. **Verso dell'orbita** (`app/src/lib/orbitSense.ts`):
   `orbitSense(trueObliqDeg, trueLim, projObliqDeg, projLim): 'prograde' | 'retrograde' | null`.
   Usa `pl_trueobliq` (ψ, 0–180°) se misurato, altrimenti `pl_projobliq`
   (λ, −180–180°, si usa |λ|). `< 90°` → prograda, `> 90°` → retrograda;
   esattamente 90°, limiti o dati assenti → `null`. È l'orientamento
   dell'orbita rispetto alla rotazione della stella, non la rotazione del
   pianeta: l'etichetta UI lo dice.
5. **UI — pannello stella** (`ui/StarPanel.tsx`, solo stelle ospiti, ancorate
   e non): `<details data-testid="star-advanced">` "Dati avanzati" con:
   metallicità (dex, con [Fe/H] o [M/H] da `st_metratio`), età (Gyr), massa
   (M☉), log g (cgs), tipo spettrale, periodo di rotazione (giorni),
   v sin i (km/s). Valori limite con prefisso "<" o ">"; assenti → "n/d".
   Per la stella ospite ancorata la riga "Età" esistente (oggi sempre "n/d"
   con la nota "non nei dati HYG") mostra `st_age` quando presente; senza
   `st_age` resta com'è.
6. **UI — pannello pianeta** (`ui/SystemOverlay.tsx`, `PlanetDetails`):
   `<details data-testid="planet-advanced">` "Dati avanzati" con: densità
   (g/cm³), irraggiamento (S⊕), provenienza della massa (misurata / minima /
   stimata da relazione massa-raggio), composizione indicativa (con nota
   "modello approssimato"), orbita prograda/retrograda rispetto alla rotazione
   della stella.
7. **i18n**: nuove chiavi in en/it/es/fr/de (etichette, unità, valori della
   composizione e del verso, provenienza della massa, note).
8. **Formattazione**: helper puro in `lib/` per "valore con limite"
   (`formatLimited(value, lim, …)`), usato da entrambi i pannelli; unit test.

Nessuna dipendenza nuova. Nessun valore astronomico inventato: ogni valore
mostrato viene dal catalogo o dal modello citato. SPEC invariata (il §6.6 vieta
già i valori fabbricati; questa issue aggiunge solo dati presenti nella fonte).

## Test

- **pytest**: nuove colonne presenti nell'output per gli host delle fixture;
  valore e flag dalla stessa riga; `null` preservati.
- **Unit** `planetComposition`, con punti ricavati dalle curve della tabella
  (la Terra sta sulla curva rocciosa, quindi non è un caso di test stabile):
  a 5 M⊕, raggio 0.95·R_rock → `rocky`, raggio a metà tra R_rock e
  R_water50 → `water`, raggio 1.1·R_water50 → `gaseous`; controlli di buon
  senso lontani dai confini: Nettuno (17.1 M⊕, 3.88 R⊕) e Giove (317.8 M⊕,
  11.2 R⊕) → `gaseous`; `massProv` `Msini` o `M-R relationship` → `null`;
  massa/raggio `null` o ≤ 0 → `null`.
- **Unit** `orbitSense`: ψ 10 → prograda; ψ 120 → retrograda; λ −150 con ψ
  assente → retrograda; ψ misurato prevale su λ; 90°, limiti, assenti →
  `null`.
- **Unit** `formatLimited`: misura, limite superiore, limite inferiore, `null`.
- **Unit** caricamento: un host senza i nuovi campi viene normalizzato a
  `null`.
- **E2e** (golden fixture TRAPPIST-1 / Proxima Cen): la sezione stella e la
  sezione pianeta si aprono da tastiera; i valori mostrati corrispondono alla
  fixture (letti dalla fixture nel test, non scritti a mano); un campo
  assente nella fixture compare come "n/d"; `axe` senza violazioni
  serious/critical con le sezioni aperte.
- **Regressione**: e2e esistenti del pannello stella e del pannello pianeta
  invariati; il test della riga "Età" aggiornato solo se la fixture ha
  `st_age` per l'host ancorato.

## Acceptance

- AC1: pannello stella (ospiti) con sezione "Dati avanzati": metallicità,
  età, massa, log g, tipo spettrale, rotazione; limiti con "<"/">"; assenti
  "n/d".
- AC2: pannello pianeta con sezione "Dati avanzati": densità, irraggiamento,
  provenienza della massa, composizione indicativa (solo massa misurata,
  etichettata modello approssimato), orbita prograda/retrograda (solo con
  obliquità misurata).
- AC3: cicli solari, asse e verso di rotazione del pianeta, composizione
  della stella non compaiono; il motivo è in `STATE.md`.
- AC4: l'app funziona con un `exoplanets.json` senza i nuovi campi.
- AC5: stringhe in 5 lingue; `axe` pulito; gate completo + pytest verdi.
- AC6: crescita di `exoplanets.json` misurata e riportata in `STATE.md`.
