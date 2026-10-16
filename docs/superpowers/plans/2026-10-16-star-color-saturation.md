# Saturazione dei colori delle stelle (issue #9) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** saturazione dei colori delle stelle regolabile dalle Opzioni, in
Galaxy View e System View.

**Spec:** `docs/superpowers/specs/2026-10-16-star-color-saturation-design.md`

**Branch:** `feat/star-color-saturation`

## Task 1: setting, shader uniform e slider della saturazione

**Files:**
- Modify: `app/src/state/settings.ts`, `app/src/lib/hostStarStyle.ts`,
  `app/src/scene/StarCloud.tsx`, `app/src/scene/HostStar.tsx`,
  `app/src/ui/OptionsPanel.tsx`, `app/src/ui/ControlDock.tsx`,
  `app/src/i18n/locales/{en,it,es,fr,de}.json`
- Test: `app/tests/unit/settings.test.ts`,
  `app/tests/unit/hostStarStyle.test.ts`, `app/tests/e2e/options.spec.ts`

**Interfaccia:**

```ts
interface Settings {
  /** Per-channel hue exponent (uColorGamma): 1 = catalog colors, 0 = white. */
  starColorSaturation: number; // default STAR_COLOR_GAMMA (2.5)
}
export function hostStarLook(
  realism: boolean,
  reducedMotion: boolean,
  colorSaturation: number,
): HostStarLook; // colorGamma: realism ? 1 : colorSaturation
```

**Passi:**
- [ ] Test red: unit (settings default/reset; `hostStarLook` col terzo
      argomento) + e2e (Galaxy View: slider disabilitato con realismo,
      persistenza, reset a `2.5`; System View: slider visibile).
- [ ] Setting in `settings.ts`.
- [ ] `StarCloud` e `HostStar`/`hostStarLook` usano il setting; realismo → 1.
- [ ] `SliderSetting` esportato; slider 0–4, step 0,1, 1 decimale,
      `disabled={realism}` in `OptionsPanel` (sezione Stelle) e in
      `SystemOptions`; commenti aggiornati; chiave i18n
      `options.starColorSaturation`.
- [ ] Gate completo verde, axe senza violazioni serious/critical.

**Acceptance:** AC1–AC4 della spec.
