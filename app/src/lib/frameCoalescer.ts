/**
 * Coalesces bursts of updates (slider drag) into at most one run per frame,
 * always with the latest value (#40). The scheduler is injectable so the
 * helper is testable without a DOM.
 */
export interface FrameScheduler {
  request(cb: () => void): number;
  cancel(handle: number): void;
}

export const rafScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(() => cb()),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface FrameCoalescer<T> {
  /** Queue `value`; replaces any value still pending for this frame. */
  schedule(value: T): void;
  /** Drop the pending run, if any. */
  cancel(): void;
}

export function createFrameCoalescer<T>(
  run: (value: T) => void,
  scheduler: FrameScheduler = rafScheduler,
): FrameCoalescer<T> {
  let handle: number | null = null;
  let latest: T;
  return {
    schedule(value) {
      latest = value;
      if (handle !== null) return;
      handle = scheduler.request(() => {
        handle = null;
        run(latest);
      });
    },
    cancel() {
      if (handle === null) return;
      scheduler.cancel(handle);
      handle = null;
    },
  };
}
