/**
 * Per-star Gaia/TYC catalog ids from catalog-ids.bin (CHECKPOINT 1 contract):
 * little-endian, fixed 16-byte stride, index-aligned —
 *   gaia uint64 (0 = absent) | tyc1 u16 | tyc2 u16 | tyc3 u8 | 3 pad bytes.
 * The fixed stride lets a single HTTP Range request fetch one star's record,
 * so the 40 MB file is not downloaded in full, unless the server ignores Range.
 */

import { DATA_BASE_URL } from './starData';
export interface CatalogIds {
  gaia: string | null; // decimal string — Gaia ids exceed JS safe integers
  tyc: string | null; // "tyc1-tyc2-tyc3"
}

const STRIDE = 16;
// In-flight promises are cached too, so concurrent callers share one request.
const cache = new Map<number, Promise<CatalogIds>>();

export function parseCatalogIdsRecord(bytes: Uint8Array): CatalogIds {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gaia = view.getBigUint64(0, true);
  const tyc1 = view.getUint16(8, true);
  const tyc2 = view.getUint16(10, true);
  const tyc3 = view.getUint8(12);
  return {
    gaia: gaia === 0n ? null : gaia.toString(),
    tyc: tyc1 === 0 && tyc2 === 0 && tyc3 === 0 ? null : `${tyc1}-${tyc2}-${tyc3}`,
  };
}

// Servers that ignore Range answer 200 with the whole file: it is downloaded once and
// every record is read from this shared promise (#38). Dropped on failure to allow a retry.
let fullFile: Promise<Uint8Array> | null = null;
let rangeSupported = false;
// First request in flight while the server behaviour is unknown: concurrent lookups wait
// for it, otherwise each would start its own full download on a Range-less server.
let probe: Promise<unknown> | null = null;

function readFullFile(resp: Response): Promise<Uint8Array> {
  const pending = resp.arrayBuffer().then((b) => new Uint8Array(b));
  fullFile = pending;
  pending.catch(() => {
    if (fullFile === pending) fullFile = null;
  });
  return pending;
}

async function requestRecord(index: number, baseUrl: string): Promise<CatalogIds> {
  const start = index * STRIDE;
  const resp = await fetch(`${baseUrl}catalog-ids.bin`, {
    headers: { Range: `bytes=${start}-${start + STRIDE - 1}` },
  });
  if (resp.status === 206) {
    rangeSupported = true;
    return parseCatalogIdsRecord(new Uint8Array(await resp.arrayBuffer()));
  }
  if (!resp.ok) throw new Error(`catalog-ids fetch failed: ${resp.status}`);
  const buf = await readFullFile(resp);
  return parseCatalogIdsRecord(buf.subarray(start, start + STRIDE));
}

async function fetchRecord(index: number, baseUrl: string): Promise<CatalogIds> {
  while (!fullFile && !rangeSupported && probe) await probe;
  if (fullFile) {
    const buf = await fullFile;
    return parseCatalogIdsRecord(buf.subarray(index * STRIDE, (index + 1) * STRIDE));
  }
  const request = requestRecord(index, baseUrl);
  if (rangeSupported) return request;
  const mine = request.then(
    () => undefined,
    () => undefined,
  );
  probe = mine;
  void mine.then(() => {
    if (probe === mine) probe = null;
  });
  return request;
}

export function fetchCatalogIds(index: number, baseUrl = DATA_BASE_URL): Promise<CatalogIds> {
  const cached = cache.get(index);
  if (cached) return cached;
  const pending = fetchRecord(index, baseUrl);
  cache.set(index, pending);
  // Dropped on failure so a later call can retry.
  pending.catch(() => cache.delete(index));
  return pending;
}

export function _clearCatalogIdsCacheForTests(): void {
  cache.clear();
  fullFile = null;
  rangeSupported = false;
  probe = null;
}
