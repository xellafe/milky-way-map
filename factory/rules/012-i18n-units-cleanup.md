# Rules 012-i18n-units-cleanup

## Conventions
- A value and its unit, and punctuation around translated text, are rendered through an interpolated locale key (`units.valueUnit` via `withUnit` in `app/src/lib/withUnit.ts`, `Trans` with named `components` when markup is wrapped), never concatenated in JSX — French needs U+00A0 there (#47, `StatTile.tsx`, `PlanetCard.tsx`).
- Every locale value has the same `{{placeholders}}` and `<tags>` as its `en` value (enforced in `app/tests/unit/i18n.test.ts`) — a translation that drops a placeholder renders raw or empty text silently (#47).

## Don'ts
- A Python script run from Bash that rewrites a file builds the full content before `open(p, 'w')` and passes `encoding='utf8'` — a cp1252 `UnicodeEncodeError` on a non-ASCII character truncated `app/tests/unit/i18n.test.ts` to an empty file (#47).
