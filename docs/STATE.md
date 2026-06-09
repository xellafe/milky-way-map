# STATE.md — Stato sviluppo Galaxy Map

> Aggiornare a ogni `[CHECKPOINT]`. È il punto di ripresa dello sviluppo.

## Stato corrente

- **Data ultimo aggiornamento:** 2026-06-09
- **Milestone completate:** **M0 — Init progetto & tooling** ✅ (AC verificati, vedi tabella checkpoint)
- **Milestone corrente:** — (M0 chiusa, fermo al `[CHECKPOINT 0]`)
- **Prossimo passo:** attendere ok umano al `[CHECKPOINT 0]`, poi avviare **M1 — Data pipeline** (SPEC §9): ETL Python AT-HYG/HYG → `stars.bin` + manifest + `names.index.json`; fetch esopianeti NASA TAP → `exoplanets.json`; cross-match; golden fixtures (~1000 stelle, TRAPPIST-1, Alpha Centauri). Skill di riferimento: `athyg-etl`, `tap-exoplanet-fetch`.

## Cosa esiste (M0)

- `app/` — Vite 8 + React 19 + TS 6 strict; scena R3F vuota a sfondo nero (`src/scene/GalaxyScene.tsx`); check WebGL2 con messaggio di fallback i18n (`src/lib/webgl.ts`, SPEC §10); store Zustand skeleton con default SPEC §13 (`src/state/store.ts`); i18n EN/IT/ES/FR/DE con detector sessionStorage (`src/i18n/`); ESLint 10 flat + Prettier + Vitest + Playwright configurati.
- `data-pipeline/` — skeleton: `requirements.txt` pinnato (pandas 3.0.3, numpy 2.4.6, astropy 7.2.0, pyvo 1.9.0, requests 2.34.2, pytest 9.0.3), `fixtures/` vuota. Codice ETL in M1.
- `.github/workflows/ci.yml` — lint+typecheck+unit+build+e2e (frontend) e install deps Python; `data-refresh.yml` — skeleton cron settimanale (ETL cablato in M1/M9).
- `README.md` root con budget prestazionali; test unit: completezza chiavi locale + default store.

## Decisioni prese in M0

- **Versioni pinnate** (esatte, in `app/package.json` + lockfile): react 19.2.7, three 0.184.0, @react-three/fiber 9.6.1, drei 10.7.7, @react-three/postprocessing 3.0.4, postprocessing 6.39.1, zustand 5.0.14, i18next 26.3.1, react-i18next 17.0.8, vite 8.0.16, typescript 6.0.3, eslint 10.4.1, vitest 4.1.8, @playwright/test 1.60.0, tailwindcss 4.3.0. Compatibilità verificata (typescript-eslint 8.61 supporta ESLint 10 e TS <6.1; plugin-react 6.0.2 e vitest 4.1.8 supportano Vite 8).
- **Budget bundle (SPEC §7, da verificare in M9):** JS iniziale ≤ **600 KB gzip** (escl. dati stellari, streamati a parte); CSS ≤ 50 KB gzip. Misura M0: **311.6 KB gzip** JS, 1.6 KB CSS. Nota: warning rolldown su chunk >500 KB *minificato* → valutare code-splitting della System View in M9.
- **Persistenza lingua**: `sessionStorage` via i18next-browser-languagedetector ("persistente nella sessione", SPEC §6.8).
- **eslint-plugin-react-hooks 7.x**: la config flat è `configs.flat.recommended` (le chiavi `configs['recommended-latest']` sono legacy e rompono ESLint 10).
- Branch rinominato `master` → `main` (allineato al default GitHub; il remoto sarà creato dall'umano).
- Unica unit e2e baseline: smoke Playwright su `vite preview` porta 4173 (build richiesta prima di `test:e2e`).

## Assunzioni aperte / da verificare in implementazione

- DOI esatto della tabella `pscomppars` (NASA) — recuperare al fetch (M1), non inventare.
- Fonte e licenza del set di linee delle costellazioni (decidere in M6).
- Numeri di performance (FPS) sono **target**, da misurare in M2/M9.
- Dipendenze Python pinnate ma non ancora installate/esercitate localmente (verifica d'import in CI; uso reale in M1). pandas 3.0 è un major recente: attenzione a copy-on-write/string dtype in M1.

## Checkpoint raggiunti

| Checkpoint | Milestone | Esito AC | Note |
|---|---|---|---|
| `[CHECKPOINT 0]` | M0 | ✅ tutti passati | build ok (tsc -b + vite build); scena nera renderizzata (smoke Playwright verde + screenshot ispezionato); `npm run lint` ok; `npm run typecheck` ok; 14 unit test verdi; format Prettier ok |

## Come riprendere

1. Leggi `docs/SPEC.md` e `AGENTS.md`.
2. Guarda "Milestone corrente / Prossimo passo" qui sopra.
3. Comandi utili: `cd app && npm ci && npm run dev` (frontend); `npm run build && npm run test:e2e` (smoke, richiede `npx playwright install chromium`).
4. M1 parte da `data-pipeline/`: leggere le skill `.claude/skills/athyg-etl/SKILL.md` e `.claude/skills/tap-exoplanet-fetch/SKILL.md`.
