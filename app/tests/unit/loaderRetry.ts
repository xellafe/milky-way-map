import { expect, vi } from 'vitest';
import type { LoadStatus } from '../../src/data/loadStatus';

/**
 * Shared retry contract for the single-file loaders (#36): a failed fetch is
 * not cached, a successful one is, and the status getter tracks each phase.
 */
export async function expectRetryAfterFailure(
  load: () => Promise<unknown>,
  getStatus: () => LoadStatus,
  body: unknown,
): Promise<void> {
  const responses: ((resp: Response) => void)[] = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        responses.push(resolve);
      }),
  );
  vi.stubGlobal('fetch', fetchMock);

  expect(getStatus()).toBe('idle');
  const first = load();
  expect(getStatus()).toBe('loading');
  // Concurrent calls during a pending load share one fetch.
  expect(load()).toBe(first);
  responses[0]!(new Response('boom', { status: 500 }));
  await expect(first).rejects.toThrow(/500/);
  expect(getStatus()).toBe('error');

  const second = load();
  expect(getStatus()).toBe('loading');
  responses[1]!(new Response(JSON.stringify(body), { status: 200 }));
  await expect(second).resolves.toBeDefined();
  expect(getStatus()).toBe('ready');
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await load();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(getStatus()).toBe('ready');
}
