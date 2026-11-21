// `?pdb=1` turns on the e2e test bridges (globalThis.__camera, __system, ...) and
// preserveDrawingBuffer so tests can read real pixels back. Read once at module
// load; `location` is missing outside the browser (unit tests, SSR).
export const exposeBridge: boolean =
  new URLSearchParams(globalThis.location?.search ?? '').get('pdb') === '1';
