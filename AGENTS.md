# AGENTS.md — Convenzioni per l'agente implementatore

Questo file governa **come** implementare Galaxy Map. La fonte di verità sul
**cosa** è `docs/SPEC.md`. Leggi entrambi prima di scrivere codice.

---

## Regole non negoziabili

1. **Esegui le milestone M0–M9 in ordine** (SPEC §9). Non saltare avanti.
2. **Auto-verifica gli acceptance criteria** di una milestone *prima* di iniziare la successiva. Se un AC non passa, non proseguire.
3. **Fermati a ogni `[CHECKPOINT]`**: aggiorna `docs/STATE.md` e interrompi. Lo sviluppo può essere ripreso in seguito leggendo `STATE.md`.
4. Il **`[FINAL HUMAN CHECK]` (fine M9) è obbligatorio**: nessun rilascio pubblico senza approvazione umana.
5. **Non fabbricare mai valori astronomici.** Dato assente = `n/d` / `null`.
6. **Non cambiare lo stack core o le versioni pinnate** (SPEC §3) senza approvazione umana.
7. **Non renderizzare mesh per singola stella.** La nuvola è un unico `Points` con shader (SPEC §4.2).
8. **Rispetta le licenze** (SPEC §12, `NOTICE.md`): codice MIT, dati CC BY-SA.

## Workflow

- Un branch + un commit/PR coerente **per milestone**; messaggi chiari e atomici.
- Scrivi i **test insieme** al codice, non dopo.
- **Esternalizza tutte le stringhe** utente (i18n) fin da subito.
- Funzioni piccole, tipate (TypeScript strict), nessun `any` implicito.
- Documenta ogni **assunzione sui dati** astronomici nel codice e in `STATE.md`.
- Politica dati: artefatti grandi in `data/` → gitignore o Git LFS; **fixtures piccole committate**.

## Subagent (ruoli suggeriti)

| Subagent | Responsabilità | Skill di riferimento |
|---|---|---|
| `data-pipeline` | ETL HYG/AT-HYG + esopianeti, cross-match | `athyg-etl`, `tap-exoplanet-fetch` |
| `rendering` | nuvola Points, shader, bloom, picking, camera | `three-points-shader` |
| `ui-ux` | overlay 2D, ricerca, filtri, pannelli, System View | — |
| `i18n-a11y` | locale EN/IT/ES/FR/DE, accessibilità, reduced-motion | `react-i18n-setup` |
| `qa` | Vitest, Playwright, verifica acceptance criteria | — |

Le skill sono in `.claude/skills/<nome>/SKILL.md`.

## Protocollo di CHECKPOINT / ripresa

A ogni `[CHECKPOINT]` aggiorna `docs/STATE.md` con:
- milestone completate e AC verificati (con esito);
- milestone corrente e prossimo passo;
- decisioni prese e assunzioni aperte;
- come riprendere (comandi, file rilevanti).

Alla **ripresa**: leggi `docs/STATE.md` e riparti dall'ultimo checkpoint, **non** da zero.

## Definition of Done globale

Una feature è "done" solo se: codice + test verdi + stringhe esternalizzate +
gestione errori (SPEC §10) + documentata + AC della milestone superati.
