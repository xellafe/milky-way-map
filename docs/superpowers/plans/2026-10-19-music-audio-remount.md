# Audio del music player ricreato su phone (issue #33) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** l'`<audio>` del player non si rimonta mai al cambio espanso/compresso o di layout.

**Spec:** `docs/superpowers/specs/2026-10-19-music-audio-remount-design.md`

**Branch:** `fix/music-audio-remount`

## Task 1: radice stabile per l'`<audio>` e test di regressione

**Files:**
- Modify: `app/src/ui/MusicPlayer.tsx`
- Test: `app/tests/e2e/mobileHud.spec.ts`

**Passi:**
- [ ] Test red: su phone, play → marca `dataset` sull'`<audio>` → imposta il
      volume → espandi/comprimi/espandi → stesso elemento, non in pausa,
      volume invariato; desktop espanso → resize a phone → stesso elemento.
- [ ] Fix: `<>{audio}{body}</>` con `body` sheet o `HudCard`; commento
      aggiornato.
- [ ] Gate completo verde.
- [ ] Commit `fix(ui): keep the music audio element mounted on phone`.
