# AGENTS.md — Convenzioni per l'agente implementatore

Questo file governa **come** implementare Galaxy Map. La fonte di verità sul
**cosa** è `docs/SPEC.md`. Leggi entrambi prima di scrivere codice.

Le regole valgono per la sessione principale (il controller) e per tutti gli
agenti in `.claude/agents/`.

---

## Regole non negoziabili

1. **Le milestone M0–M9 (SPEC §9) sono completate**; il lavoro nuovo segue il [Workflow per issue](#workflow-per-issue).
2. **Auto-verifica gli acceptance criteria** (della milestone o della spec della issue) *prima* di proseguire. Se un AC non passa, non proseguire.
3. **Fermati a ogni `[CHECKPOINT]`**: aggiorna `docs/STATE.md` e interrompi. Lo sviluppo può essere ripreso in seguito leggendo `STATE.md`.
4. Il **`[FINAL HUMAN CHECK]` (fine M9) è obbligatorio**: nessun rilascio pubblico senza approvazione umana.
5. **Non fabbricare mai valori astronomici.** Dato assente = `n/d` / `null`.
6. **Non cambiare lo stack core o le versioni pinnate** (SPEC §3) senza approvazione umana.
7. **Non renderizzare mesh per singola stella.** La nuvola è un unico `Points` con shader (SPEC §4.2).
8. **Rispetta le licenze** (SPEC §12, `NOTICE.md`): codice MIT, dati CC BY-SA.

## Workflow per issue

1. Issue → spec in `docs/superpowers/specs/` → piano in `docs/superpowers/plans/` → pipeline per task (sotto).
2. Un branch per issue; un commit per task del piano.
3. A fine issue il `documenter` aggiorna `STATE.md` e il `committer` ne fa un commit a parte (`docs(state): …`); poi il controller chiede all'umano push e PR.

Il controller è la sessione principale: fa i dispatch degli agenti e non scrive
codice. Pipeline per ogni task:

```
tester (red) → coder → code-reviewer ⟲ coder (max 3 giri) → tester (verify)
  → documenter → committer
```

- I brief stanno in `.superpowers/sdd/<piano>/task-<n>-brief.md` (gitignored) e
  contengono solo: obiettivo, file, interfacce, riferimenti SPEC/spec,
  acceptance, eventuale `mode` del tester. Le regole di questo file non si
  ricopiano nei brief.
- Le modifiche del `documenter` a un task entrano nel commit di quel task.
- **Escalation all'umano**: 3 giri di review senza `APPROVED`, un `BLOCKED`, un
  conflitto con `SPEC.md`, una dipendenza nuova o un cambio di versione.
- Con la skill `superpowers:subagent-driven-development`: implementer →
  `tester` (`red`) + `coder`; spec/quality reviewer → `code-reviewer`;
  commit → `committer`.

## Codice

- Funzioni piccole, tipate (TypeScript strict), nessun `any` implicito.
- Esternalizza tutte le stringhe utente (i18n) in `en/it/es/fr/de.json`.
- Politica dati: artefatti grandi in `data/` → gitignore o Git LFS; **fixtures piccole committate**.

## Lingua

- **Inglese**: codice, identificatori, commenti, messaggi di commit, `README.md`, `data-pipeline/README.md`.
- **Italiano**: `SPEC.md`, `STATE.md`, `NOTICE.md`, `AGENTS.md`, spec e piani.
- Stringhe UI solo nei file i18n.

## Commenti

1. In inglese; spiegano il **perché** (vincolo, decisione, trappola), non il cosa; niente parafrasi del codice.
2. Citano una fonte stabile quando esiste: `SPEC §x`, `#<issue>`, un paper. **Mai** task del piano, giri di review o nomi di agenti.
3. Ogni costante di tuning riporta unità e natura: **dato**, **scelta estetica (non dato)** o **scelta umana**.
4. Ogni assunzione sui dati astronomici è scritta nel codice (e in `STATE.md`).
5. Niente codice commentato, niente commenti da changelog ("was X, now Y").
6. `TODO` solo con issue: `TODO(#12): …`.
7. Semplificazione deliberata con limite noto: `Deliberate simplification: <limite>; upgrade when <condizione>`.
8. Densità dei commenti allineata al file circostante.

## Commit e branch

- Branch da `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`. Mai commit su `main`.
- Formato `type(scope): subject`:
  - `type` ∈ `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`;
  - `scope` ∈ `ui`, `state`, `render`, `system`, `camera`, `lib`, `i18n`, `a11y`, `pipeline`, `data`, `deploy`, `ci`, `agents`; per `docs`: `state`, `readme`, `spec`, `plan`, `notice`, `agents`;
  - `scope` si omette solo per modifiche trasversali al repo (es. `chore: enforce LF line endings`).
- Subject all'imperativo, minuscolo, senza punto finale, ≤ 72 caratteri.
- Body obbligatorio se il diff non è banale: perché + verifiche (comandi ed esiti), righe ≤ 72.
- Trailer fisso: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Messaggi multilinea con `git commit -F <file>`.

## Gate di qualità

| Gate | Comando | Chi |
|---|---|---|
| veloce | `cd app && npm run typecheck && npm run lint && npm run format:check && npm test` | coder, committer |
| completo | gate veloce + `npm run build && npm run test:e2e` | tester `verify` |
| pipeline | `cd data-pipeline && python -m pytest -q` | tester, se la pipeline è toccata |

## Test

- Unit `app/tests/unit/*.test.ts`; e2e `app/tests/e2e/*.spec.ts`; pytest `data-pipeline/tests/`.
- Vitest gira senza DOM: la logica sta in `lib/`/`state/` con unit test; i componenti li copre Playwright.
- I `data-testid` sono un contratto: si rinominano solo aggiornando i test, con un motivo.
- Le modifiche di layout si verificano con i bounding box, non solo con la presenza nel DOM.
- Ogni bug fix ha un test di regressione che fallisce prima del fix.
- Mai `.only`/`.skip` committati; mai retry aggiunti per nascondere un test flaky; i flaky si annotano in `STATE.md` → "Test flaky noti".
- Modifiche UI: `axe` senza violazioni serious/critical.
- Dati di test dalle golden fixture (SPEC §5.4), mai inventati.

## Mappa dei documenti

| Se cambia… | Aggiorna |
|---|---|
| feature visibile, comandi, struttura | `README.md` |
| budget misurato (FPS, bundle) | tabella in `README.md` + `STATE.md` |
| pipeline o fonti dati | `data-pipeline/README.md`; `NOTICE.md` se la fonte è nuova |
| asset o dato con licenza | `NOTICE.md` |
| decisione, assunzione sui dati, esito AC | `STATE.md` (fine issue o checkpoint): una sezione per issue, bullet ≤ 3 righe, per i dettagli di debug si rimanda allo SHA del commit |
| requisito o vincolo di prodotto | `SPEC.md`, **solo con approvazione umana** |
| regola di workflow | `AGENTS.md`, **solo con approvazione umana** |

## Trappole note

1. Mai array tipizzati grandi in state/props React: vanno nei module holder (`starCoreStore`, `labelStore`); React 19 in dev va in OOM.
2. Il CSS custom in `index.css` sta in `@layer components`: il CSS fuori layer batte le utility Tailwind.
3. Tailwind: una classe passata via `className` non vince su una di pari specificità (l'ordine nella stringa non conta); se una dimensione deve variare, esporla come prop.
4. StrictMode in dev esegue gli effetti due volte (vedi `f8defa5`).
5. Path dei dati sempre via `DATA_BASE_URL`, mai `'/data/'` hard-coded.
6. Nel tool Bash niente here-string PowerShell (`@'…'@`).
7. Tailwind: una classe in un template literal va separata da uno spazio da `${…}` (`bg-x ${cond}`, mai `bg-x${cond}`): lo scanner legge il token con `${` e non genera la regola, che funziona solo se la classe compare anche altrove (vedi `4132d02`).

## Agenti

| Agente | Modello / effort | Ruolo |
|---|---|---|
| `tester` | sonnet / medium | `red`: test che falliscono dal brief; `verify`: gate completo e verifiche a runtime |
| `coder` | sonnet / medium | implementa fino al verde senza modificare i test |
| `code-reviewer` | opus / high | sola lettura: conformità, semplicità, commenti, vincoli, test |
| `documenter` | sonnet / low | aggiorna i documenti secondo la mappa; propone, non applica, modifiche a `SPEC.md`/`AGENTS.md` |
| `committer` | haiku / low | verifica i gate e fa un commit locale; mai push |

Definizioni in `.claude/agents/<nome>.md`. Le skill di dominio restano in
`.claude/skills/<nome>/SKILL.md` e le caricano `coder` e `tester` secondo l'area
toccata.

## Protocollo di CHECKPOINT / ripresa

A ogni `[CHECKPOINT]` aggiorna `docs/STATE.md` con:
- milestone completate e AC verificati (con esito);
- milestone corrente e prossimo passo;
- decisioni prese e assunzioni aperte;
- come riprendere (comandi, file rilevanti).

Alla **ripresa**: leggi `docs/STATE.md` e riparti dall'ultimo checkpoint, **non** da zero.

## Definition of Done globale

Una feature è "done" solo se: codice + test verdi + stringhe esternalizzate +
gestione errori (SPEC §10) + documentata + AC superati + verdetto
`code-reviewer` `APPROVED` + gate `format:check` verde.
