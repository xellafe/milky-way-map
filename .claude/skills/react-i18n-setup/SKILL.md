# SKILL: react-i18n-setup

Configura internazionalizzazione (EN/IT/ES/FR/DE) e accessibilità best-effort
(SPEC §6.8, §6.9). Subagent `i18n-a11y`. Milestone **M8** (ma esternalizza le stringhe fin da M0).

## i18n
- `i18next` + `react-i18next`. Lingua **default EN**; rilevamento + selettore persistente in sessione.
- Locale in `app/src/i18n/locales/{en,it,es,fr,de}.json`, namespace per area (es. `ui`, `details`, `system`, `errors`).
- **Tutte** le stringhe utente passano da `t()`. Nessuna stringa hardcoded nei componenti.
- Numeri/unità (ly, AU, giorni) formattati con `Intl` secondo la lingua.
- EN e IT completi e curati; ES/FR/DE completi ma rivedibili.

## Accessibilità (best effort)
- UI 2D completamente **operabile da tastiera**, ARIA sui pannelli, focus management coerente.
- La **ricerca** è il percorso accessibile per raggiungere una stella senza navigazione 3D col mouse.
- Rispetta `prefers-reduced-motion`: riduci/disabilita le transizioni animate (fly-to, orbite).
- Contrasto adeguato dell'overlay sul fondo nero.
- Il canvas 3D è un limite noto e documentato: non promettere accessibilità piena della scena.

## Gotcha
- Esternalizzare le stringhe *dopo* è costoso: fallo da subito.
- Le label dinamiche (nomi stelle/pianeti) vengono dai dati, non dai locale: non tradurle.

## Done
Cambio lingua funziona su tutta la UI; navigazione da tastiera dei pannelli; check `axe` sull'overlay senza violazioni bloccanti; reduced-motion rispettato (M8 AC).
