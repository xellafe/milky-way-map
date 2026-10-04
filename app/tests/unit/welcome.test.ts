import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WELCOME_DISMISSED_KEY,
  isWelcomeDismissed,
  setWelcomeDismissed,
} from '../../src/lib/welcome';

function stubStorage(): Storage {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('welcome dismissal flag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not dismissed when the key is absent', () => {
    stubStorage();
    expect(isWelcomeDismissed()).toBe(false);
  });

  it('persists and clears the flag', () => {
    const storage = stubStorage();
    setWelcomeDismissed(true);
    expect(storage.getItem(WELCOME_DISMISSED_KEY)).toBe('1');
    expect(isWelcomeDismissed()).toBe(true);
    setWelcomeDismissed(false);
    expect(storage.getItem(WELCOME_DISMISSED_KEY)).toBeNull();
    expect(isWelcomeDismissed()).toBe(false);
  });

  it('tolerates a localStorage whose methods throw', () => {
    const boom = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(isWelcomeDismissed()).toBe(false);
    expect(() => setWelcomeDismissed(true)).not.toThrow();
  });

  it('tolerates a missing localStorage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(isWelcomeDismissed()).toBe(false);
    expect(() => setWelcomeDismissed(true)).not.toThrow();
  });
});
