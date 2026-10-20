---
base_branch: main
build: cd app && npm run build
lint: cd app && npm run typecheck && npm run lint && npm run format:check
test: cd app && npm test && npm run test:e2e
ui_review: browser     # none | static | browser
dev_server: "cd app && npm run dev"
base_url: "http://localhost:5173"
max_rounds: 2          # rework rounds after the first review
---
Notes for every agent:
- Read `AGENTS.md` (conventions) and `docs/SPEC.md` (source of truth) before working.
- Code, identifiers, comments, commit messages: English. Specs, `docs/STATE.md`: Italian.
- UI strings only in the i18n files (`en/it/es/fr/de.json`).
- Never fabricate astronomical values: missing data = `n/d` / `null`.
- Do not change the core stack or pinned versions (SPEC §3) without human approval.
- Large typed arrays never in React state/props: use the module holders (`starCoreStore`, `labelStore`).
- Data paths always via `DATA_BASE_URL`, never a hard-coded `'/data/'`.
- If `data-pipeline/` is touched, also run `cd data-pipeline && python -m pytest -q`.
- Do not edit `docs/SPEC.md` or `AGENTS.md` without human approval.
- Dev server needs the generated artifacts in `data/`; no login required.
