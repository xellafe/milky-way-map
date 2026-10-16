# Velocità dell'auto-orbit della camera (issue #8) — design

## Obiettivo

L'auto-orbit attorno alla stella selezionata è troppo veloce. L'utente ne
regola la velocità dal pannello Opzioni; il default scende a 2°/s.

## Stato attuale

- `app/src/scene/CameraControls.tsx`: costante `AUTO_ORBIT_RAD_PER_S = 0.1`
  (~5,7°/s, un giro ogni ~63 s), applicata a ogni frame con
  `orbitAroundTarget` se l'auto-orbit è attivo.
- `app/src/state/settings.ts`: impostazione booleana `autoOrbit` (persistita).
- `app/src/ui/OptionsPanel.tsx`: sezione Camera con lo slider della velocità
  di movimento e l'interruttore dell'auto-orbit; in System View la sezione è
  nascosta (#23).

## Design

1. **Setting** `autoOrbitSpeedDegPerS: number` in `Settings`, default `2`
   (scelta umana). Persistito con le altre impostazioni e ripristinato dal
   reset. Una chiave nuova non richiede di cambiare la `version` di `persist`:
   gli stati salvati senza la chiave ricevono il default.
2. **Camera**: `CameraControls` legge il setting a ogni frame e lo converte in
   rad/s; la costante `AUTO_ORBIT_RAD_PER_S` sparisce. Invariati lo stop al
   drag, l'assenza di auto-orbit con prefers-reduced-motion e con
   l'interruttore spento.
3. **UI**: `SliderSetting` con id `autoOrbitSpeedDegPerS` sotto l'interruttore
   dell'auto-orbit; range 0,5–10°/s, step 0,5 (scelta dell'agente), suffisso
   `°/s`, disabilitato quando `autoOrbit` è spento. Nascosto in System View
   come il resto della sezione Camera.
4. **i18n**: etichetta `options.autoOrbitSpeed` in en/it/es/fr/de.

Nessuna dipendenza nuova, SPEC invariata.

## Test

- Unit `settings.test.ts`: il default include `autoOrbitSpeedDegPerS: 2`;
  il reset lo ripristina.
- E2e `options.spec.ts`: lo slider `option-autoOrbitSpeedDegPerS` è
  disabilitato con l'auto-orbit spento, il valore persiste al reload, il
  reset riporta `2`; assente in System View.
- Axe senza violazioni serious/critical sul pannello Opzioni.

## Acceptance

- AC1: default 2°/s; con lo slider la velocità angolare dell'auto-orbit
  cambia di conseguenza.
- AC2: lo slider è disabilitato con l'auto-orbit spento e nascosto in System
  View.
- AC3: il valore persiste al reload e il reset lo riporta a 2.
- AC4: stringa tradotta nelle 5 lingue; gate completo verde.
