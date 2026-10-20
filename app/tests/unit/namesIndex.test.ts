import { afterEach, describe, it, vi } from 'vitest';
import {
  _setNamesIndexForTests,
  getNamesIndexStatus,
  loadNamesIndex,
} from '../../src/data/namesIndex';
import { expectRetryAfterFailure } from './loaderRetry';

afterEach(() => {
  _setNamesIndexForTests(null);
  vi.unstubAllGlobals();
});

describe('loadNamesIndex retry (#36)', () => {
  it('retries after a failed fetch, then caches the success', async () => {
    await expectRetryAfterFailure(() => loadNamesIndex('/data/'), getNamesIndexStatus, {
      '0': { proper: 'Sol' },
    });
  });
});
