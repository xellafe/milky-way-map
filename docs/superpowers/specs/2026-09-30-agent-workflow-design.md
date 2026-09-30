# Workflow ad agenti per ruolo: design

- **Data:** 2026-09-30
- **Branch:** `chore/agent-workflow` (da `main`)
- **Stato:** in revisione

## 1. Obiettivo

Definire cinque subagent di progetto per ruolo (`coder`, `code-reviewer`,
`tester`, `documenter`, `committer`) e le regole di progetto che mancano perché
lavorino bene senza che il controller le ripeta in ogni brief.

**Problema attuale.** I vincoli operativi vivono in parte in `AGENTS.md`, in
parte nella memoria dell'assistente e in parte in
`.superpowers/sdd/<piano>/global-constraints.md` (gitignored), ricopiato a mano
in ogni brief. `AGENTS.md` è ancora scritto per le milestone M0–M9, ma il
progetto ora procede per issue (#1–#3, branch `feat/*`, PR).

**Successo:**
- i cinque agenti esistono in `.claude/agents/` e sono visibili in una sessione nuova;
- ogni regola necessaria agli agenti è scritta una volta sola, in `AGENTS.md`;
- un task del piano passa da brief a commit con brief che contengono solo il
  contenuto specifico del task (pilota: §6.3).

## 2. Decisioni prese

| Domanda | Scelta |
|---|---|
| Ordine coder/tester | **Tester prima**: test che falliscono dal brief → coder fino al verde senza toccare i test → tester riesegue tutto |
| Subagent per dominio di `AGENTS.md` | **Sostituiti** dai 5 agenti per ruolo; la conoscenza di dominio resta nelle skill `.claude/skills/` |
| Permessi del committer | **Solo commit locali**; push, PR e merge restano all'umano |
| Dove vivono le regole | **In `AGENTS.md`** (fonte unica); i file agente sono snelli e la richiamano |
| Enforcement | Istruzioni + campo `tools`; hook solo alla prima violazione osservata |
| Modelli | vedi §3.2 |
| SPEC §11 | aggiunta di **una riga** che rimanda ad `AGENTS.md` (approvata dall'umano) |

**Vincoli tecnici verificati** (doc ufficiale Claude Code, subagent):
`model` accetta alias (`sonnet`, `opus`, `haiku`); `effort` accetta
`low`…`max`; `tools`/`disallowedTools` **non** limitano Bash a singoli comandi
(serve un hook `PreToolUse`); `skills` precarica skill all'avvio; i subagent
possono lanciarne altri (bloccabile con `disallowedTools: Agent`); gli agenti di
progetto si caricano all'avvio della sessione.

## 3. Agenti

### 3.1 Regole comuni

- File in `.claude/agents/<nome>.md`, prompt in **inglese**.
- Prima di agire: leggere `AGENTS.md` e le sezioni di `docs/SPEC.md` citate nel brief.
- `disallowedTools: Agent` per tutti.
- Divieti per tutti: `git commit` (tranne il committer), qualunque push,
  modifiche a `docs/SPEC.md` e ad `AGENTS.md`.
- Ogni agente termina con un report in questo formato:

```
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
FILES: <path> (created|modified|deleted), ...
COMMANDS: <comando> → <esito> + estratto dell'output reale
ASSUMPTIONS: <assunzioni aperte, o "none">
NOTES: <solo se servono>
```

Il reviewer aggiunge `VERDICT` e `FINDINGS`; il committer aggiunge `COMMIT`.

### 3.2 Riepilogo

| Agente | `model` | `effort` | `tools` | Input | Output |
|---|---|---|---|---|---|
| `tester` | sonnet | medium | Read, Write, Edit, Bash, Grep, Glob, Skill | brief + `mode` | test, esiti |
| `coder` | sonnet | medium | Read, Write, Edit, Bash, Grep, Glob, Skill | brief + test rossi (o findings) | codice |
| `code-reviewer` | opus | high | Read, Grep, Glob, Bash | brief, spec, diff non committato | verdetto + findings |
| `documenter` | sonnet | low | Read, Write, Edit, Grep, Glob, Bash | report, diff, brief | doc aggiornati o "no changes" |
| `committer` | haiku | low | Read, Bash, Grep, Glob | report tester `verify` + verdetto reviewer | commit locale |

### 3.3 `tester`

- **`mode: red`**: scrive dal brief i test che falliscono (unit
  `app/tests/unit/*.test.ts`, e2e `app/tests/e2e/*.spec.ts`, pytest
  `data-pipeline/tests/`); li esegue e verifica che falliscano **perché la
  feature manca**, non per errori nel test. Non tocca il codice di produzione.
- **`mode: verify`**: esegue il gate completo (§5.5) e, se la pipeline è
  toccata, il gate pipeline; esegue le verifiche a runtime richieste dal brief
  (bounding box, `axe`).
- Test flaky: se un test fallisce, lo rilancia una volta isolato; se passa, lo
  segnala come `FLAKY` nel report, senza nasconderlo.
- Mai indebolire, cancellare o mettere in `.skip`/`.only` un test per ottenere
  il verde. Mai valori astronomici inventati: golden fixture (SPEC §5.4).
- Carica la skill di dominio dell'area toccata, se esiste.

### 3.4 `coder`

- Carica la skill dell'area toccata (`three-points-shader`, `athyg-etl`,
  `tap-exoplanet-fetch`, `react-i18n-setup`).
- Implementa il minimo che porta al verde i test del tester.
- **Non modifica i test.** Se un test è sbagliato: `NEEDS_CONTEXT` con il motivo.
- Prima del report: gate veloce (§5.5).
- Nei giri di correzione risponde a ogni finding del reviewer (fixed / motivo del rifiuto).

### 3.5 `code-reviewer`

Sola lettura. Legge `git diff HEAD` e `git status --short` (la review avviene
prima del commit; i file non tracciati vanno letti per intero). Checklist:

1. **Conformità**: ogni requisito del brief è implementato; nulla in più (scope creep).
2. **Semplicità**: nessuna astrazione non richiesta; riuso degli helper esistenti; niente codice morto.
3. **Commenti**: regole di §5.3.
4. **Vincoli di progetto**: parità i18n nelle 5 lingue, nessun valore inventato,
   niente array tipizzati grandi in state/props, a11y e reduced-motion,
   nessuna dipendenza nuova, licenze, trappole note (§5.8).
5. **Test**: coprono i comportamenti del brief; nessuno indebolito.

`VERDICT: APPROVED | CHANGES_REQUESTED`. Ogni finding: severità
(`critical` / `important` / `minor`), `file:line`, perché, correzione
suggerita. `APPROVED` è ammesso con soli `minor`, che vanno elencati come
rinviati.

### 3.6 `documenter`

- Decide cosa aggiornare con la mappa dei documenti (§5.7); "no changes" è un esito valido.
- `STATE.md`: solo a fine issue, a fine fase o a un `[CHECKPOINT]`.
- `SPEC.md`, `AGENTS.md` e spec già approvate: non li modifica; **propone** il diff nel report.
- Lingua secondo §5.2; per l'italiano valgono le regole di scrittura dell'utente
  (nessuna parola inventata, termini tecnici non tradotti, conciso).

### 3.7 `committer`

1. **Gate** (tutti obbligatori, altrimenti `BLOCKED`):
   - branch corrente ≠ `main`;
   - verdetto reviewer `APPROVED` e report tester `verify` con `STATUS: DONE`, passati dal controller;
   - riesegue il gate veloce (§5.5); gli e2e no, fa fede il report `verify`.
2. **Staging**: solo i file elencati nei report (`git add <path>…`, mai `-A` o
   `.`); se `git status` mostra file inattesi → `BLOCKED`; mai `data/*`,
   `.superpowers/`, `app/test-results/`.
3. **Messaggio**: formato di §5.4, scritto in un file non tracciato
   (`.superpowers/commit-msg.txt`, gitignored) e committato con
   `git commit -F .superpowers/commit-msg.txt`.
4. **Mai**: push, `--amend`, rebase, `--no-verify`, force, commit su `main`.

## 4. Pipeline

Il controller è la sessione principale: fa i dispatch, non scrive codice. Per
ogni task del piano:

```
tester (red) → coder → code-reviewer ⟲ coder (max 3 giri) → tester (verify)
  → documenter → committer
```

- I brief restano in `.superpowers/sdd/<piano>/task-<n>-brief.md` (gitignored)
  e contengono solo: obiettivo, file, interfacce, riferimenti SPEC/spec,
  acceptance, eventuale `mode`. Le regole generali non si ricopiano.
- Le modifiche del documenter a un task entrano nel commit di quel task;
  l'aggiornamento di `STATE.md` a fine issue è un commit a parte
  (`docs(state): …`).
- Escalation all'umano: 3 giri di review senza `APPROVED`, un `BLOCKED`, un
  conflitto con SPEC.md, una dipendenza nuova o un cambio di versione.
- Con la skill `superpowers:subagent-driven-development` la mappatura è:
  implementer → `tester` (`red`) + `coder`; spec/quality reviewer →
  `code-reviewer`; commit → `committer`.

## 5. Nuove regole in `AGENTS.md`

`AGENTS.md` resta in italiano. Le sezioni sotto si aggiungono o sostituiscono
quelle esistenti come indicato.

### 5.1 Regole non negoziabili (modifica)

- Regola 1 diventa: *"Le milestone M0–M9 (SPEC §9) sono completate; il lavoro
  nuovo segue il Workflow per issue."*
- Regola 2 diventa: *"Auto-verifica gli acceptance criteria (della milestone o
  della spec della issue) prima di proseguire."*
- Regole 3–8 invariate.

**Workflow per issue (nuova sezione, sostituisce "Workflow"):**
1. issue → spec in `docs/superpowers/specs/` → piano in `docs/superpowers/plans/` → pipeline per task (§4);
2. un branch per issue; un commit per task del piano;
3. a fine issue il documenter aggiorna `STATE.md`, poi il controller chiede all'umano push/PR;
4. escalation come in §4.

### 5.2 Lingua

- **Inglese**: codice, identificatori, commenti, messaggi di commit, `README.md`, `data-pipeline/README.md`.
- **Italiano**: `SPEC.md`, `STATE.md`, `NOTICE.md`, `AGENTS.md`, spec e piani.
- Stringhe UI solo nei file i18n.

### 5.3 Commenti

1. In inglese; spiegano il **perché** (vincolo, decisione, trappola), non il cosa; niente parafrasi del codice.
2. Citano una fonte stabile quando esiste: `SPEC §x`, `#<issue>`, un paper. **Mai** task del piano, giri di review o nomi di agenti.
3. Ogni costante di tuning riporta unità e natura: **dato**, **scelta estetica (non dato)** o **scelta umana**.
4. Ogni assunzione sui dati astronomici è scritta nel codice (e in `STATE.md`).
5. Niente codice commentato, niente commenti da changelog ("was X, now Y").
6. `TODO` solo con issue: `TODO(#12): …`.
7. Semplificazione deliberata con limite noto: `Deliberate simplification: <limite>; upgrade when <condizione>`.
8. Densità dei commenti allineata al file circostante.

### 5.4 Commit e branch

- Branch da `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`. Mai commit su `main`.
- `type(scope): subject`:
  - `type` ∈ `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`;
  - `scope` ∈ `ui`, `state`, `render`, `system`, `camera`, `lib`, `i18n`, `a11y`, `pipeline`, `data`, `deploy`, `ci`, `agents`; per `docs`: `state`, `readme`, `spec`, `plan`, `notice`, `agents`;
  - `scope` si omette solo per modifiche trasversali al repo (es. `chore: enforce LF line endings`).
- Subject imperativo, minuscolo, senza punto finale, ≤ 72 caratteri.
- Body obbligatorio se il diff non è banale: perché + verifiche (comandi ed esiti), righe ≤ 72.
- Trailer fisso: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Messaggi multilinea: `git commit -F <file>`.

### 5.5 Gate di qualità

| Gate | Comando | Chi |
|---|---|---|
| veloce | `cd app && npm run typecheck && npm run lint && npm run format:check && npm test` | coder, committer |
| completo | gate veloce + `npm run build && npm run test:e2e` | tester `verify` |
| pipeline | `cd data-pipeline && python -m pytest -q` | tester, se la pipeline è toccata |

### 5.6 Test

- Unit `app/tests/unit/*.test.ts`; e2e `app/tests/e2e/*.spec.ts`; pytest `data-pipeline/tests/`.
- Vitest gira senza DOM: la logica sta in `lib/`/`state/` con unit test; i componenti li copre Playwright.
- I `data-testid` sono un contratto: si rinominano solo aggiornando i test, con motivo.
- Le modifiche di layout si verificano con bounding box, non solo con la presenza nel DOM.
- Ogni bug fix ha un test di regressione che fallisce prima del fix.
- Mai `.only`/`.skip` committati; mai retry aggiunti per nascondere un flaky; i flaky si annotano in `STATE.md` → "Test flaky noti".
- Modifiche UI: `axe` senza violazioni serious/critical.
- Dati di test dalle golden fixture, mai inventati.

### 5.7 Mappa dei documenti

| Se cambia… | Aggiorna |
|---|---|
| feature visibile, comandi, struttura | `README.md` |
| budget misurato (FPS, bundle) | tabella in `README.md` + `STATE.md` |
| pipeline o fonti dati | `data-pipeline/README.md`; `NOTICE.md` se la fonte è nuova |
| asset o dato con licenza | `NOTICE.md` |
| decisione, assunzione sui dati, esito AC | `STATE.md` (fine issue/checkpoint): una sezione per issue, bullet ≤ 3 righe, dettagli di debug → SHA del commit |
| requisito o vincolo di prodotto | `SPEC.md`, **solo con approvazione umana** |
| regola di workflow | `AGENTS.md`, **solo con approvazione umana** |

### 5.8 Trappole note

1. Mai array tipizzati grandi in state/props React: module holder (`starCoreStore`, `labelStore`); React 19 in dev va in OOM.
2. Il CSS custom in `index.css` sta in `@layer components`: il CSS fuori layer batte le utility Tailwind.
3. Tailwind: una classe passata via `className` non vince su una di pari specificità (l'ordine nella stringa non conta); se una dimensione deve variare, esporla come prop.
4. StrictMode in dev esegue gli effetti due volte (vedi `f8defa5`).
5. Path dei dati sempre via `DATA_BASE_URL`, mai `'/data/'` hard-coded.
6. Nel tool Bash niente here-string PowerShell (`@'…'@`).

### 5.9 Agenti (sostituisce "Subagent (ruoli suggeriti)")

Tabella di §3.2 più la mappatura con `subagent-driven-development` di §4. Le
skill di dominio restano in `.claude/skills/`.

### 5.10 Definition of Done (modifica)

Ai criteri esistenti si aggiungono: verdetto reviewer `APPROVED` e gate
`format:check` verde.

### 5.11 SPEC §11 (approvato dall'umano)

Aggiunta di una sola riga in testa alla sezione: *"Dopo M9 le convenzioni
operative vivono in `AGENTS.md`, che prevale su questa sezione."* Nessun'altra
modifica a SPEC.md.

## 6. Rollout

### 6.1 Commit su `chore/agent-workflow` (worktree `.claude/worktrees/agent-workflow`)

| # | Commit | Contenuto | Verifica |
|---|---|---|---|
| 1 | `docs(spec): agent workflow design` | questo documento | — |
| 2 | `chore: enforce LF line endings` | `.gitattributes` (`* text=auto eol=lf`), rilettura dei file nel worktree, `prettier --write app/vite.config.ts` | `npm run format:check` verde |
| 3 | `ci: check formatting` | step `npm run format:check` dopo `lint` in `.github/workflows/ci.yml` | — |
| 4 | `docs(agents): role-based workflow rules` | §5 in `AGENTS.md` + riga SPEC §11 | rilettura |
| 5 | `chore(agents): add role-based subagents` | 5 file `.claude/agents/*.md` (§3) | frontmatter valido |

Il commit 2 è fattibile senza conflitti: `format:check` fallisce su 27 file ma
26 solo per CRLF (`core.autocrlf=true`, index già LF); l'unico problema reale è
`app/vite.config.ts`, che `feat/sci-fi-ui` non tocca.

### 6.2 Dopo il merge (push, PR e merge: decisioni umane)

1. Su `feat/sci-fi-ui`: chiudere il Task 2.2 con il flusso attuale, correggendo
   i commenti che violano §5.3 (`app/tests/e2e/smoke.spec.ts:20`, `:42`,
   `app/tests/e2e/view.spec.ts:13`, `app/src/ui/ControlDock.tsx:127`); poi
   merge di `main` in `feat/sci-fi-ui`.
2. A working tree pulito, rilettura una tantum dei file per passare a LF:
   `git rm -rq --cached . && git reset --hard`. Sicuro **solo** su working
   tree pulito: da confermare con l'umano prima di eseguirlo.

### 6.3 Pilota

Task 3.1 del piano sci-fi (scale degli indicatori: logica pura, adatta al
tester-first) eseguito con la pipeline di §4 in una sessione nuova. Il pilota
riesce se:
- il brief non ricopia regole generali;
- ogni agente chiude con il report di §3.1;
- il commit rispetta §5.4 e contiene solo i file del task.

## 7. Fuori perimetro

- Hook di enforcement (blocco di `git commit` fuori dal committer, husky): alla prima violazione osservata.
- Campo `memory` degli agenti.
- Compattazione delle sezioni esistenti di `STATE.md`: il nuovo formato vale per le sezioni nuove.
