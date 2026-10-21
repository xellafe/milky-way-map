/**
 * Loader for the stars.bin SoA artifact (SPEC §5.1, pipeline contract).
 *
 * Coordinate frame (documented per skill `three-points-shader`): heliocentric
 * equatorial axes in light-years — +x → RA 0h / Dec 0°, +y → RA 6h / Dec 0°,
 * +z → north celestial pole. Little-endian data; typed-array views assume a
 * little-endian platform (x86/ARM — the WebGL baseline).
 *
 * Loading strategy (SPEC §7, progressive): each attribute section is fetched
 * independently with HTTP Range requests. The CORE sections needed for first
 * paint (position, colorRGB, sizeAbsMag, spectralClass, flags ≈ 45% of the
 * file) are awaited; the DETAIL sections (distances, magnitudes, B–V,
 * luminosity — needed for panels/filters from M3 on) load in the background.
 * A server that ignores Range (200) switches the load to one shared full-file
 * download sliced per section, so the file is never fetched twice (#38).
 */

export interface AttributeMeta {
  name: string;
  dtype: 'float32' | 'uint8';
  components: number;
  byteOffset: number;
  byteLength: number;
}

export interface StarsManifest {
  version: number;
  count: number;
  units: string;
  frame: string;
  byteLength: number;
  attributes: AttributeMeta[];
  exclusions?: Record<string, number | string>;
}

export interface StarCoreData {
  count: number;
  position: Float32Array;
  colorRGB: Uint8Array;
  sizeAbsMag: Float32Array;
  spectralClass: Uint8Array;
  flags: Uint8Array;
}

export interface StarDetailData {
  distanceLy: Float32Array;
  appMag: Float32Array;
  absMag: Float32Array;
  colorIndex: Float32Array;
  luminosity: Float32Array;
}

/**
 * Where the data artifacts are served: `<app base>/data/`. The base is `/`
 * locally and the repo sub-path on GitHub Pages (VITE_BASE at build time).
 */
export const DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`;

const CORE_ATTRIBUTES = ['position', 'colorRGB', 'sizeAbsMag', 'spectralClass', 'flags'] as const;
const DETAIL_ATTRIBUTES = ['distanceLy', 'appMag', 'absMag', 'colorIndex', 'luminosity'] as const;
const DTYPE_BYTES: Record<AttributeMeta['dtype'], number> = { float32: 4, uint8: 1 };

/**
 * The manifest contradicts itself (#38). Kept distinct from network errors
 * because reloading cannot fix corrupt data (SPEC §10).
 */
export class StarManifestError extends Error {
  override name = 'StarManifestError';
}

const isNonNegativeInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** Rejects a manifest whose sections would read `undefined` or past the file. */
function validateManifest(raw: unknown): StarsManifest {
  const fail = (subject: string, rule: string): never => {
    throw new StarManifestError(`stars manifest: ${subject} ${rule}`);
  };
  if (typeof raw !== 'object' || raw === null) return fail('manifest', 'is not an object');
  const m = raw as Record<string, unknown>;
  const count = m['count'];
  const fileLength = m['byteLength'];
  const attributes = m['attributes'];
  if (!isNonNegativeInt(count)) return fail('count', 'must be a non-negative integer');
  if (!isNonNegativeInt(fileLength)) return fail('byteLength', 'must be a non-negative integer');
  if (!Array.isArray(attributes)) return fail('attributes', 'must be an array');

  for (const name of [...CORE_ATTRIBUTES, ...DETAIL_ATTRIBUTES]) {
    const subject = `attribute ${name}`;
    const a = (attributes as unknown[]).find(
      (x): x is Record<string, unknown> =>
        typeof x === 'object' && x !== null && (x as Record<string, unknown>)['name'] === name,
    );
    if (!a) return fail(subject, 'is missing');
    const dtype = a['dtype'];
    if (typeof dtype !== 'string' || !Object.hasOwn(DTYPE_BYTES, dtype)) {
      return fail(subject, `has unknown dtype ${String(dtype)}`);
    }
    const components = a['components'];
    if (!Number.isInteger(components) || (components as number) <= 0) {
      return fail(subject, 'components must be a positive integer');
    }
    const expected = count * (components as number) * DTYPE_BYTES[dtype as AttributeMeta['dtype']];
    if (a['byteLength'] !== expected) {
      return fail(
        subject,
        `byteLength must equal count × components × sizeof(dtype) = ${expected}`,
      );
    }
    const byteOffset = a['byteOffset'];
    if (!isNonNegativeInt(byteOffset)) {
      return fail(subject, 'byteOffset must be a non-negative integer');
    }
    if (byteOffset + expected > fileLength) {
      return fail(subject, 'byteOffset + byteLength exceeds the manifest byteLength');
    }
  }
  return raw as StarsManifest;
}

export async function fetchManifest(baseUrl: string, signal?: AbortSignal): Promise<StarsManifest> {
  const resp = await fetch(`${baseUrl}stars.manifest.json`, { signal });
  if (!resp.ok) throw new Error(`manifest fetch failed: ${resp.status}`);
  return validateManifest(await resp.json());
}

const shortBodyError = (meta: AttributeMeta, got: number) =>
  new Error(`section ${meta.name}: got ${got} of ${meta.byteLength} bytes`);

/**
 * Read a 206 section. The reader is cancelled once the section is complete:
 * a server may keep streaming past the requested range (#38).
 */
async function readPartial(
  resp: Response,
  meta: AttributeMeta,
  onBytes: (delta: number) => void,
): Promise<Uint8Array> {
  const out = new Uint8Array(meta.byteLength);
  if (!resp.body) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    const take = Math.min(buf.byteLength, meta.byteLength);
    out.set(buf.subarray(0, take));
    onBytes(take);
    if (take < meta.byteLength) throw shortBodyError(meta, take);
    return out;
  }
  const reader = resp.body.getReader();
  let written = 0;
  while (written < meta.byteLength) {
    const { done, value } = await reader.read();
    if (done) break;
    const take = Math.min(value.byteLength, meta.byteLength - written);
    out.set(value.subarray(0, take), written);
    written += take;
    onBytes(take);
  }
  if (written < meta.byteLength) throw shortBodyError(meta, written);
  reader.cancel().catch(() => {});
  return out;
}

/** Read a whole 200 body, capped at `total` bytes; returns what was received. */
async function readFull(
  resp: Response,
  total: number,
  onReceived: (received: number) => void,
): Promise<Uint8Array> {
  const out = new Uint8Array(total);
  if (!resp.body) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    const take = Math.min(buf.byteLength, total);
    out.set(buf.subarray(0, take));
    onReceived(take);
    return out.subarray(0, take);
  }
  const reader = resp.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const take = Math.min(value.byteLength, total - received);
    out.set(value.subarray(0, take), received);
    received += take;
    onReceived(received);
  }
  return out.subarray(0, received);
}

function sliceSection(file: Uint8Array, meta: AttributeMeta): Uint8Array {
  const available = Math.max(0, Math.min(file.byteLength - meta.byteOffset, meta.byteLength));
  if (available < meta.byteLength) throw shortBodyError(meta, available);
  return file.subarray(meta.byteOffset, meta.byteOffset + meta.byteLength);
}

/** Views a slice of the shared full file in place; copies only when misaligned. */
function asFloat32(bytes: Uint8Array): Float32Array {
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice();
  return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);
}

function attributeMeta(manifest: StarsManifest, name: string): AttributeMeta {
  const meta = manifest.attributes.find((a) => a.name === name);
  if (!meta) throw new Error(`attribute ${name} missing from manifest`);
  return meta;
}

export interface StarLoadHandle {
  manifest: StarsManifest;
  core: Promise<StarCoreData>;
  details: Promise<StarDetailData>;
}

/**
 * Start loading. `onProgress` reports CORE progress in [0,1] (first paint);
 * detail sections continue in the background via the `details` promise.
 * Aborting `signal` rejects both with an `AbortError` and starts no further
 * request (StrictMode remount in dev, #38).
 */
export function loadStars(
  baseUrl: string,
  manifest: StarsManifest,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal,
): StarLoadHandle {
  const url = `${baseUrl}stars.bin`;
  const meta = Object.fromEntries(
    [...CORE_ATTRIBUTES, ...DETAIL_ATTRIBUTES].map((n) => [n, attributeMeta(manifest, n)]),
  ) as Record<(typeof CORE_ATTRIBUTES | typeof DETAIL_ATTRIBUTES)[number], AttributeMeta>;

  // Monotonic: Range sections may have counted bytes before a 200 switches the
  // progress basis to the full file.
  let lastProgress = 0;
  const report = (done: number, total: number) => {
    const fraction = total > 0 ? Math.min(done / total, 1) : 1;
    if (fraction < lastProgress) return;
    lastProgress = fraction;
    onProgress(fraction);
  };
  const coreTotal = CORE_ATTRIBUTES.reduce((s, n) => s + meta[n].byteLength, 0);
  let coreLoaded = 0;
  const onCoreBytes = (delta: number) => {
    coreLoaded += delta;
    report(coreLoaded, coreTotal);
  };

  // Set by the first 200 response; every other section is sliced from it.
  let fullFile: Promise<Uint8Array> | null = null;

  const fetchSection = async (
    m: AttributeMeta,
    onBytes: (delta: number) => void,
  ): Promise<Uint8Array> => {
    signal?.throwIfAborted();
    if (!fullFile) {
      const end = m.byteOffset + m.byteLength - 1;
      const resp = await fetch(url, {
        headers: { Range: `bytes=${m.byteOffset}-${end}` },
        signal,
      });
      if (resp.status === 206) {
        const out = await readPartial(resp, m, onBytes);
        signal?.throwIfAborted();
        return out;
      }
      if (!resp.ok) throw new Error(`section ${m.name} fetch failed: ${resp.status}`);
      if (fullFile) {
        resp.body?.cancel().catch(() => {});
      } else {
        const total = manifest.byteLength;
        fullFile = readFull(resp, total, (received) => report(received, total));
      }
    }
    const file = await fullFile;
    signal?.throwIfAborted();
    return sliceSection(file, m);
  };

  const coreSection = (n: (typeof CORE_ATTRIBUTES)[number]) => fetchSection(meta[n], onCoreBytes);
  const detailSection = async (n: (typeof DETAIL_ATTRIBUTES)[number]) =>
    asFloat32(await fetchSection(meta[n], () => {}));

  const core = (async (): Promise<StarCoreData> => {
    const [position, colorRGB, sizeAbsMag, spectralClass, flags] = await Promise.all([
      coreSection('position'),
      coreSection('colorRGB'),
      coreSection('sizeAbsMag'),
      coreSection('spectralClass'),
      coreSection('flags'),
    ]);
    return {
      count: manifest.count,
      position: asFloat32(position),
      colorRGB,
      sizeAbsMag: asFloat32(sizeAbsMag),
      spectralClass,
      flags,
    };
  })();

  const details = (async (): Promise<StarDetailData> => {
    await core; // do not compete with first paint for bandwidth
    const [distanceLy, appMag, absMag, colorIndex, luminosity] = await Promise.all([
      detailSection('distanceLy'),
      detailSection('appMag'),
      detailSection('absMag'),
      detailSection('colorIndex'),
      detailSection('luminosity'),
    ]);
    return { distanceLy, appMag, absMag, colorIndex, luminosity };
  })();

  return { manifest, core, details };
}
