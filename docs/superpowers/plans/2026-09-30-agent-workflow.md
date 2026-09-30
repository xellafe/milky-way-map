# Workflow ad agenti per ruolo — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 subagent di progetto per ruolo in `.claude/agents/`, regole mancanti scritte una volta in `AGENTS.md`, fine riga LF e `format:check` come gate reale.

**Architecture:** le regole vivono solo in `AGENTS.md`; i file agente sono snelli (frontmatter + procedura + report) e rimandano ad `AGENTS.md`. Enforcement via campo `tools` e istruzioni, niente hook. Tutto su `chore/agent-workflow`, nel worktree `.claude/worktrees/agent-workflow`.

**Tech Stack:** Claude Code subagent (frontmatter YAML), git attributes, Prettier 3.8.4, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-agent-workflow-design.md` (commit `78d3bd2`)

## Global Constraints

- Tutti i comandi dal worktree `F:\galaxy-map\.claude\worktrees\agent-workflow`. **Mai** eseguire comandi che riscrivono il working tree in `F:\galaxy-map` (lì c'è lavoro non committato di `feat/sci-fi-ui`).
- Nessuna dipendenza nuova; versioni pinnate invariate (AGENTS regola 6). `npm ci` usa il lockfile esistente.
- Nessun push, nessuna PR, nessun merge: solo commit locali.
- `docs/SPEC.md`: solo la riga di spec §5.11, nient'altro.
- Commit: formato di spec §5.4, trailer `Co-Authored-By: Claude <noreply@anthropic.com>`, messaggio multilinea con `git commit -F <file>`.
- Lingua: `AGENTS.md` in italiano; file agente e messaggi di commit in inglese (spec §5.2).

## Review Focus

1. **Rinormalizzazione che tocca file binari** (`app/src/assets/background-music.mp3`, `*.png`): `text=auto` deve lasciarli intatti → verifica in Task 1 Step 4.
2. **Rilettura dei file (`git rm --cached` + `reset --hard`) eseguita nel checkout sbagliato**: distruggerebbe il lavoro non committato in `F:\galaxy-map` → Task 1 Step 3 verifica `git rev-parse --show-toplevel` prima.
3. **Regola esistente persa nella riscrittura di `AGENTS.md`** (regole 3–8, politica dati, protocollo CHECKPOINT, TS strict) → checklist in Task 2 Step 3.
4. **Agente non caricato per frontmatter invalido** (`name` diverso dal nome file, YAML rotto): Claude Code lo ignora in silenzio → Task 3 Step 2.
5. **Delega automatica indesiderata** (es. la sessione principale lancia `committer` di sua iniziativa): le `description` devono dire che l'agente si usa solo su dispatch del controller → Task 3 Step 1–2.

---

### Task 1: fine riga LF e `format:check` in CI

**Files:**
- Create: `.gitattributes`
- Modify: `app/vite.config.ts` (solo formattazione Prettier)
- Modify: `.github/workflows/ci.yml:21` (step dopo `npm run lint`)

**Interfaces:**
- Produces: `npm run format:check` verde su checkout LF; è parte del "gate veloce" scritto in Task 2.

- [ ] **Step 1: crea `.gitattributes`** con esattamente una riga: `* text=auto eol=lf`.

- [ ] **Step 2: verifica che l'index sia già LF**

Run: `git add --renormalize . && git status --short`
Expected: solo `?? .gitattributes` (`--renormalize` agisce sui file tracciati; nessuno cambia perché l'index è già LF). Se compaiono altri file, elencarli nel report e includerli nel commit solo se sono file di testo.

- [ ] **Step 3: commit e rilettura dei file nel worktree**

Run: `git rev-parse --show-toplevel`
Expected: `F:/galaxy-map/.claude/worktrees/agent-workflow`. Altrimenti **fermarsi**.

`git add .gitattributes` → commit `chore: enforce LF line endings` (body: `core.autocrlf=true` produceva CRLF nel working tree e 26 falsi positivi di Prettier; index già LF). Poi: `git rm -rq --cached . && git reset -q --hard` (worktree pulito dopo il commit → sicuro).

- [ ] **Step 4: verifica LF e binari intatti**

Run: `git ls-files --eol app/src/App.tsx app/vite.config.ts app/src/assets/background-music.mp3 && git status --short`
Expected: i `.ts/.tsx` `i/lf w/lf`; l'mp3 `i/-text w/-text`; `git status` vuoto.

- [ ] **Step 5: installa e controlla il formato**

Run: `cd app && npm ci && npm run format:check`
Expected: FAIL solo su `vite.config.ts`.

- [ ] **Step 6: formatta e riverifica**

Run: `npx prettier --write vite.config.ts && npm run format:check && npm run typecheck && npm run lint`
Expected: `All matched files use Prettier code style!`, typecheck e lint senza errori.

- [ ] **Step 7: step CI** — in `.github/workflows/ci.yml`, subito dopo `- run: npm run lint`, aggiungi `- run: npm run format:check` (stessa indentazione).

- [ ] **Step 8: commit**

`git add app/vite.config.ts .github/workflows/ci.yml` → commit `ci: check formatting` (body: Prettier non era verificato in CI; `vite.config.ts` era l'unico file non conforme).

Nota: la spec §6.1 mette `vite.config.ts` nel commit 2; qui va nel commit 3 insieme allo step CI, perché si formatta solo dopo aver verificato il checkout LF. Contenuto complessivo invariato.

---

### Task 2: regole in `AGENTS.md` e riga in SPEC §11

**Files:**
- Modify: `AGENTS.md` (intero file, struttura sotto)
- Modify: `docs/SPEC.md:364` (una riga dopo il titolo di §11)

**Interfaces:**
- Consumes: gate veloce con `format:check` (Task 1).
- Produces: sezioni con questi titoli esatti, citate dai file agente di Task 3: `## Workflow per issue`, `## Codice`, `## Lingua`, `## Commenti`, `## Commit e branch`, `## Gate di qualità`, `## Test`, `## Mappa dei documenti`, `## Trappole note`, `## Agenti`.

- [ ] **Step 1: riscrivi `AGENTS.md`** con questa struttura, in quest'ordine; il testo di ogni sezione è quello della spec indicata (adattato solo nei riferimenti interni: "§4" della spec → "sezione Workflow per issue", ecc.):

| Sezione | Contenuto |
|---|---|
| intestazione | invariata |
| `## Regole non negoziabili` | regole 1–2 riscritte (spec §5.1), 3–8 invariate |
| `## Workflow per issue` | spec §5.1 (4 punti) + spec §4 (pipeline, brief, commit del documenter, escalation, mappatura `subagent-driven-development`) |
| `## Codice` | i bullet ancora validi del vecchio `## Workflow`: TS strict senza `any` implicito, funzioni piccole e tipate; politica dati (`data/` gitignore/LFS, fixture piccole committate) |
| `## Lingua` | spec §5.2 |
| `## Commenti` | spec §5.3 |
| `## Commit e branch` | spec §5.4 |
| `## Gate di qualità` | spec §5.5 |
| `## Test` | spec §5.6 |
| `## Mappa dei documenti` | spec §5.7 |
| `## Trappole note` | spec §5.8 |
| `## Agenti` | tabella spec §3.2 (agente, modello/effort, ruolo in una riga) + "skill di dominio in `.claude/skills/`"; sostituisce `## Subagent (ruoli suggeriti)` |
| `## Protocollo di CHECKPOINT / ripresa` | invariato |
| `## Definition of Done globale` | invariata + "verdetto reviewer `APPROVED`" + "gate `format:check` verde" (spec §5.10) |

- [ ] **Step 2: SPEC §11** — dopo la riga 364 (`## 11. Convenzioni agentiche …`) inserisci una riga vuota e: `> Dopo M9 le convenzioni operative vivono in \`AGENTS.md\`, che prevale su questa sezione.`

- [ ] **Step 3: verifica che nessuna regola sia persa**

Run: `grep -nE "FINAL HUMAN CHECK|fabbricare|stack core|mesh per singola|licenze|CHECKPOINT|any. implicito|fixtures? piccole|i18n" AGENTS.md`
Expected: almeno una riga per ciascun concetto (regole 3–8, protocollo CHECKPOINT, TS strict, politica dati, stringhe i18n). `grep -n "in ordine" AGENTS.md` non trova più la vecchia regola 1.

Run: `git diff --stat docs/SPEC.md`
Expected: `1 file changed, 2 insertions(+)`.

- [ ] **Step 4: commit** `docs(agents): role-based workflow rules` con `AGENTS.md` e `docs/SPEC.md` (body: regole prima implicite — lingua, commenti, commit, gate, test, mappa doc, trappole — ora scritte; subagent per dominio sostituiti; SPEC §11 rimanda ad `AGENTS.md`, approvato dall'umano).

---

### Task 3: i 5 file agente

**Files:**
- Create: `.claude/agents/tester.md`, `coder.md`, `code-reviewer.md`, `documenter.md`, `committer.md`

**Interfaces:**
- Consumes: titoli di sezione di `AGENTS.md` (Task 2 Produces).
- Produces: agenti richiamabili come `subagent_type: tester | coder | code-reviewer | documenter | committer`.

- [ ] **Step 1: scrivi i file.** Frontmatter (campi in quest'ordine):

| File | `name` | `model` | `effort` | `tools` |
|---|---|---|---|---|
| `tester.md` | tester | sonnet | medium | Read, Write, Edit, Bash, Grep, Glob, Skill |
| `coder.md` | coder | sonnet | medium | Read, Write, Edit, Bash, Grep, Glob, Skill |
| `code-reviewer.md` | code-reviewer | opus | high | Read, Grep, Glob, Bash |
| `documenter.md` | documenter | sonnet | low | Read, Write, Edit, Grep, Glob, Bash |
| `committer.md` | committer | haiku | low | Read, Bash, Grep, Glob |

Tutti con `disallowedTools: Agent`. `description` in inglese: una frase su cosa fa + `Dispatched by the controller as part of the AGENTS.md pipeline; do not invoke proactively.`

Corpo (inglese), sezioni in quest'ordine:
1. **Role** — una frase.
2. **Before you start** — leggere `AGENTS.md` e le sezioni SPEC citate nel brief (spec §3.1).
3. **Procedure** — quella dell'agente in spec §3.3 (tester, entrambi i `mode`), §3.4 (coder), §3.5 (reviewer, checklist a 5 punti), §3.6 (documenter), §3.7 (committer: gate → staging → messaggio). Richiamare le regole per titolo di sezione di `AGENTS.md` (es. "see AGENTS.md › Commenti") invece di ricopiarle.
4. **Never** — divieti comuni di spec §3.1 + quelli specifici dell'agente.
5. **Report** — il blocco di spec §3.1, più `VERDICT`/`FINDINGS` (reviewer) o `COMMIT: <sha> <subject>` (committer).

Lunghezza: ≤ 60 righe per file.

- [ ] **Step 2: verifica il frontmatter**

Run:
```bash
for f in .claude/agents/*.md; do n=$(basename "$f" .md); head -1 "$f" | grep -qx -- '---' && sed -n '2,10p' "$f" | grep -qx "name: $n" && [ "$(grep -c -x -- '---' "$f")" -ge 2 ] && echo "ok $n" || echo "BAD $n"; done
```
Expected: 5 righe `ok <nome>`, nessun `BAD`.

Run: `grep -L "do not invoke proactively" .claude/agents/*.md`
Expected: nessun output.

- [ ] **Step 3: commit** `chore(agents): add role-based subagents` con i 5 file (body: modelli/effort e confini per agente; regole in `AGENTS.md`; `disallowedTools: Agent`).

---

## Dopo il piano (decisioni umane, non task)

Da spec §6.2–6.3, nell'ordine:
1. Revisione del branch `chore/agent-workflow`, poi push/PR/merge a cura dell'umano.
2. Su `feat/sci-fi-ui`: chiudere il Task 2.2 correggendo i 4 commenti (spec §6.2), poi merge di `main` e `cd app && npm run format` (`store.ts` non conforme su quel branch).
3. A working tree pulito in `F:\galaxy-map`, rilettura LF (`git rm -rq --cached . && git reset --hard`) **solo dopo conferma umana**.
4. Sessione nuova (gli agenti si caricano all'avvio) → pilota sul Task 3.1 del piano sci-fi con la pipeline.
