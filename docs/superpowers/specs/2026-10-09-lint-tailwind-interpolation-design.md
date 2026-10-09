# Lint delle classi Tailwind attaccate a `${…}` (issue #27) — design

## Obiettivo

`npm run lint` fallisce se, in un template literal di `className`, una classe è
attaccata a un'interpolazione (`p-2${c}` o `${c}p-2`). Lo scanner di Tailwind
legge il token insieme a `${` e non genera la regola (trappola 7 di
`AGENTS.md`, vedi `4132d02`).

## Soluzione

Regola core `no-restricted-syntax` in `app/eslint.config.js`, nessuna
dipendenza nuova. Due selettori esquery sui `TemplateElement` figli diretti di
un `TemplateLiteral` discendente di `JSXAttribute[name.name="className"]`:

| Caso | Selettore (suffisso) |
|---|---|
| classe prima di `${` | `[tail=false][value.raw=/\S$/]` |
| classe dopo `}` | `:not(:first-child)[value.raw=/^\S/]` |

Il discendente copre anche i template annidati nelle ternarie (es.
`ToggleChip.tsx`). Il messaggio cita la trappola e l'issue.

Prototipo verificato con `Linter` su 8 snippet: 3 casi errati segnalati, 0 falsi
positivi (inclusi template multilinea e attributi non `className`).

## Limite noto

Classi composte fuori dall'attributo `className` (variabili, helper) non sono
coperte: oggi il codice non ne ha (nessun `clsx`/`cn`, tutte le classi
dinamiche stanno in `className={`…`}`).

## Acceptance

1. Il lint segnala `` className={`p-2${c}`} `` e `` className={`${c}p-2`} ``.
2. Nessun falso positivo sul codice attuale (`npm run lint` verde) né su
   attributi diversi da `className`.
3. Un unit test (`app/tests/unit/tailwindLint.test.ts`) esegue ESLint con la
   config reale sui casi sopra.
