# Saturazione dei colori delle stelle (issue #9) — design

## Obiettivo

L'utente regola a piacere quanto sono vividi i colori delle stelle, nella
nuvola della Galaxy View e sulla stella ospite della System View. È una
scelta estetica, non un dato (SPEC §13).

## Stato attuale

- `app/src/lib/starColor.ts`: `STAR_COLOR_GAMMA = 2.5`, esponente per canale
  applicato ai colori B–V del catalogo in `star.frag` e `host-star.frag`
  (uniform `uColorGamma`). >1 accentua la tinta; il bianco resta bianco.
- Il realismo forza l'esponente a 1 (colori del catalogo):
  `StarCloud.tsx` (`s.realism ? 1 : STAR_COLOR_GAMMA`) e
  `hostStarLook()` in `app/src/lib/hostStarStyle.ts`.
- Opzioni: `OptionsPanel.tsx` (Galaxy View, sezione Stelle); in System View
  `SystemOptions` in `ControlDock.tsx` mostra solo il realismo e nasconde il
  reset (#23).

## Design

1. **Setting** `starColorSaturation: number` in `Settings`, default
   `STAR_COLOR_GAMMA` (2.5: l'aspetto attuale resta invariato). Persistito e
   ripristinato dal reset; nessun cambio di `version` di `persist`.
2. **Semantica**: il valore è l'esponente `uColorGamma`. 0 → stelle bianche,
   1 → colori del catalogo, 2.5 → default, 4 → molto accesi. Sotto 1 i colori
   sbiadiscono verso il bianco (punti luminosi su fondo nero), non verso il
   grigio. Nessuna modifica agli shader né uniform nuovi.
3. **Realismo**: se attivo l'esponente resta 1 e lo slider è disabilitato,
   come gli slider del twinkle.
4. **Galaxy View**: `StarCloud` usa `s.realism ? 1 : s.starColorSaturation`.
5. **System View** (scelta umana): `hostStarLook(realism, reducedMotion,
   colorSaturation)` restituisce `colorGamma: realism ? 1 : colorSaturation`;
   `HostStar` passa il setting. Il commento di `hostStarLook` e quello di
   `SystemOptions` (oggi "only realism acts on the host star") vanno
   aggiornati.
6. **UI**: `SliderSetting` con id `starColorSaturation`, range 0–4, step 0,1
   (scelta dell'agente), 1 decimale, nessun suffisso, disabilitato con il
   realismo. In Galaxy View nella sezione Stelle sotto gli slider del twinkle;
   in System View sotto l'interruttore del realismo (serve esportare
   `SliderSetting` da `OptionsPanel.tsx`). Il reset resta nascosto in System
   View.
7. **i18n**: etichetta `options.starColorSaturation` in en/it/es/fr/de.

Nessuna dipendenza nuova, SPEC invariata.

## Test

- Unit `settings.test.ts`: default `starColorSaturation: 2.5`; reset.
- Unit `hostStarStyle.test.ts`: `colorGamma` segue il terzo argomento senza
  realismo, vale 1 con il realismo.
- E2e `options.spec.ts`: in Galaxy View lo slider `option-starColorSaturation`
  è disabilitato con il realismo, il valore persiste al reload, il reset
  riporta `2.5`; in System View lo slider è visibile (e non più nella lista
  degli assenti).
- Axe senza violazioni serious/critical sul pannello Opzioni.

## Acceptance

- AC1: default 2.5, aspetto iniziale invariato; il valore dello slider arriva
  come `uColorGamma` alla nuvola e alla stella ospite.
- AC2: con il realismo l'esponente è 1 e lo slider è disabilitato, in
  entrambe le viste.
- AC3: il valore persiste al reload e il reset (Galaxy View) lo riporta a 2.5.
- AC4: stringa tradotta nelle 5 lingue; gate completo verde.
