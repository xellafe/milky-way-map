import { describe, expect, it } from 'vitest';
import { createFrameCoalescer, type FrameScheduler } from '../../src/lib/frameCoalescer';

function makeScheduler() {
  const pending = new Map<number, () => void>();
  let next = 1;
  const scheduler: FrameScheduler = {
    request: (cb) => {
      pending.set(next, cb);
      return next++;
    },
    cancel: (h) => {
      pending.delete(h);
    },
  };
  const flush = () => {
    const cbs = [...pending.values()];
    pending.clear();
    cbs.forEach((cb) => cb());
  };
  return { scheduler, flush, pending };
}

describe('createFrameCoalescer', () => {
  it('runs once per frame with the latest value', () => {
    const { scheduler, flush, pending } = makeScheduler();
    const seen: number[] = [];
    const c = createFrameCoalescer<number>((v) => seen.push(v), scheduler);
    c.schedule(1);
    c.schedule(2);
    c.schedule(3);
    expect(pending.size).toBe(1);
    expect(seen).toEqual([]);
    flush();
    expect(seen).toEqual([3]);
  });

  it('schedules again after a frame has run', () => {
    const { scheduler, flush } = makeScheduler();
    const seen: number[] = [];
    const c = createFrameCoalescer<number>((v) => seen.push(v), scheduler);
    c.schedule(1);
    flush();
    c.schedule(2);
    flush();
    expect(seen).toEqual([1, 2]);
  });

  it('cancel drops the pending run', () => {
    const { scheduler, flush, pending } = makeScheduler();
    const seen: number[] = [];
    const c = createFrameCoalescer<number>((v) => seen.push(v), scheduler);
    c.schedule(1);
    c.cancel();
    expect(pending.size).toBe(0);
    flush();
    expect(seen).toEqual([]);
    c.schedule(2);
    flush();
    expect(seen).toEqual([2]);
  });
});
