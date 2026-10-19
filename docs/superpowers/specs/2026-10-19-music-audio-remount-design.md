# Audio del music player ricreato su phone (issue #33) — design

## Problema

In `app/src/ui/MusicPlayer.tsx` l'elemento `<audio>` sta in due posizioni
diverse dell'albero React:

- phone espanso: `<>{audio}<MobileSheet>…</MobileSheet></>` (radice Fragment);
- tutti gli altri casi: `<HudCard>{audio}…</HudCard>` (radice `HudCard`).

Espandere o comprimere il player su phone cambia il tipo della radice, quindi
React smonta e rimonta l'`<audio>`. Lo stesso accade quando il layout passa da
desktop a phone con il player espanso (resize/rotazione). Effetti:

- la riproduzione si ferma;
- il volume torna a 1.0 (default HTML): `audio.volume = DEFAULT_VOLUME` si
  applica solo nell'effect di mount, mentre lo slider continua a mostrare il
  valore dello stato React;
- l'effect di mount (deps `[]`) resta legato all'elemento vecchio.

Il commento sopra `audio` afferma il contrario. Il test
`mobileHud.spec.ts` ("keeps the audio mounted") conta solo gli `<audio>`.

## Soluzione

Una sola radice stabile: `<>{audio}{body}</>`, dove `body` è la
`MobileSheet` (phone espanso) oppure l'`HudCard`. L'`<audio>` è senza
`controls`, quindi non ha impatto sul layout fuori dalla card. Nessun'altra
modifica di comportamento.

## Acceptance

1. Su phone (375×812), dopo play: espandi → comprimi → espandi lascia lo
   stesso elemento `<audio>` (marcato via `dataset`) e `paused === false`.
2. Il volume impostato dall'utente (es. 0.75) resta sull'elemento dopo il
   toggle.
3. Desktop → phone con il player espanso non ricrea l'elemento.
4. Il test e2e di regressione fallisce prima del fix.
5. I test esistenti di `mobileHud.spec.ts`, `dock.spec.ts`, `a11y.spec.ts`
   restano verdi.
