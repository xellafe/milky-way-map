# Velocità dell'auto-orbit (issue #8) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** velocità dell'auto-orbit regolabile dalle Opzioni, default 2°/s.

**Spec:** `docs/superpowers/specs/2026-10-16-auto-orbit-speed-design.md`

**Branch:** `feat/auto-orbit-speed`

## Task 1: setting, camera e slider della velocità dell'auto-orbit

**Files:**
- Modify: `app/src/state/settings.ts`, `app/src/scene/CameraControls.tsx`,
  `app/src/ui/OptionsPanel.tsx`, `app/src/i18n/locales/{en,it,es,fr,de}.json`
- Test: `app/tests/unit/settings.test.ts`, `app/tests/e2e/options.spec.ts`

**Interfaccia:**

```ts
interface Settings {
  /** Ambient auto-orbit angular speed, degrees per second. */
  autoOrbitSpeedDegPerS: number; // default 2 (human choice)
}
```

**Passi:**
- [ ] Test red: unit (default e reset) + e2e (slider disabilitato con
      auto-orbit spento, persistenza al reload, reset a `2`, assente in
      System View).
- [ ] Setting con default 2 in `settings.ts`.
- [ ] `CameraControls`: velocità letta dal setting (°/s → rad/s), rimossa
      `AUTO_ORBIT_RAD_PER_S`.
- [ ] `OptionsPanel`: `SliderSetting` 0,5–10, step 0,5, suffisso `°/s`,
      `disabled={!settings.autoOrbit}`; chiave i18n `options.autoOrbitSpeed`.
- [ ] Gate completo verde, axe senza violazioni serious/critical.

**Acceptance:** AC1–AC4 della spec.
