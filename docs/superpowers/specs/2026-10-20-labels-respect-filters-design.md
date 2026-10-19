# Etichette delle stelle nascoste dai filtri (issue #35) — design

## Problema

`StarLabels` (`app/src/scene/StarLabels.tsx`) proietta le stelle con nome
proprio e pubblica le etichette senza leggere la maschera `aVisible` della
geometry condivisa. Con un filtro attivo (SPEC §6.5) il nome di una stella
nascosta resta sullo schermo dove la stella non è più disegnata. Shader e
picking rispettano già la maschera.

## Soluzione

Nel ciclo dei candidati, leggere `aVisible` dalla geometry condivisa
(`getStarGeometry()`) e scartare gli indici con valore `0`. Senza geometry
(non ancora costruita) il comportamento resta quello attuale. La re-layout
ogni 150 ms aggiorna le etichette dopo un cambio di filtro senza altri hook.

## Acceptance

1. Con "mostra nomi" attivo, un'etichetta visibile (es. Polaris) sparisce
   quando un filtro nasconde quella stella, e ricompare quando il filtro
   viene tolto.
2. Il test e2e di regressione fallisce prima del fix.
3. I test esistenti di `view.spec.ts` e `filters.spec.ts` restano verdi.
