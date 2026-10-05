import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFlag, writeFlag } from '../../src/lib/localFlag';

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

describe('localFlag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads false when the key is absent', () => {
    stubStorage();
    expect(readFlag('k')).toBe(false);
  });

  it('persists and clears the flag', () => {
    const storage = stubStorage();
    writeFlag('k', true);
    expect(storage.getItem('k')).toBe('1');
    expect(readFlag('k')).toBe(true);
    writeFlag('k', false);
    expect(storage.getItem('k')).toBeNull();
    expect(readFlag('k')).toBe(false);
  });

  it('tolerates a localStorage whose methods throw', () => {
    const boom = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(readFlag('k')).toBe(false);
    expect(() => writeFlag('k', true)).not.toThrow();
  });

  it('tolerates a missing localStorage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readFlag('k')).toBe(false);
    expect(() => writeFlag('k', true)).not.toThrow();
  });
});
