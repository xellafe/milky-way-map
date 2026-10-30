import { describe, expect, it } from 'vitest';
import {
  HOVER_REPICK_INTERVAL_MS,
  createLatestOnly,
  pickMinPx,
  shouldPickHover,
  type HoverPickState,
} from '../../src/lib/starPick';

describe('pickMinPx', () => {
  it('keeps the same CSS size at any DPR (mouse)', () => {
    expect(pickMinPx(false, 1)).toBe(7);
    expect(pickMinPx(false, 2)).toBe(14);
    expect(pickMinPx(false, 2)).toBe(2 * pickMinPx(false, 1));
  });
  it('scales the touch target by DPR', () => {
    expect(pickMinPx(true, 1)).toBe(22);
    expect(pickMinPx(true, 2)).toBe(44);
  });
});

describe('shouldPickHover', () => {
  const base: HoverPickState = {
    moved: false,
    inside: true,
    touch: false,
    dragging: false,
    poseChanged: false,
    inFlight: false,
    nowMs: 1000,
    lastPickMs: 0,
  };
  const s = (o: Partial<HoverPickState>) => shouldPickHover({ ...base, ...o });

  it('is false when in flight, outside or dragging, even if moved', () => {
    expect(s({ moved: true, inFlight: true })).toBe(false);
    expect(s({ moved: true, inside: false })).toBe(false);
    expect(s({ moved: true, dragging: true })).toBe(false);
    expect(s({ poseChanged: true, inFlight: true })).toBe(false);
  });
  it('is true on pointer move', () => {
    expect(s({ moved: true })).toBe(true);
    expect(s({ moved: true, touch: true })).toBe(true);
    expect(s({ moved: true, lastPickMs: 1000 })).toBe(true);
  });
  it('is false when nothing changed', () => {
    expect(s({})).toBe(false);
  });
  it('re-picks on pose change only after the interval', () => {
    const last = 1000;
    expect(
      s({ poseChanged: true, lastPickMs: last, nowMs: last + HOVER_REPICK_INTERVAL_MS - 1 }),
    ).toBe(false);
    expect(s({ poseChanged: true, lastPickMs: last, nowMs: last + HOVER_REPICK_INTERVAL_MS })).toBe(
      true,
    );
  });
  it('never re-picks on pose change for touch', () => {
    expect(s({ poseChanged: true, touch: true })).toBe(false);
  });
});

describe('createLatestOnly', () => {
  it('only the last ticket is current', () => {
    const l = createLatestOnly();
    const a = l.next();
    expect(l.isCurrent(a)).toBe(true);
    const b = l.next();
    expect(l.isCurrent(a)).toBe(false);
    expect(l.isCurrent(b)).toBe(true);
  });
  it('invalidate makes the pending ticket stale', () => {
    const l = createLatestOnly();
    const a = l.next();
    l.invalidate();
    expect(l.isCurrent(a)).toBe(false);
    const b = l.next();
    expect(l.isCurrent(b)).toBe(true);
  });
});
