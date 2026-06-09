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
 * Servers that ignore Range and reply 200 with the full body are handled.
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

const CORE_ATTRIBUTES = ['position', 'colorRGB', 'sizeAbsMag', 'spectralClass', 'flags'] as const;
const DETAIL_ATTRIBUTES = ['distanceLy', 'appMag', 'absMag', 'colorIndex', 'luminosity'] as const;

export async function fetchManifest(baseUrl: string): Promise<StarsManifest> {
  const resp = await fetch(`${baseUrl}stars.manifest.json`);
  if (!resp.ok) throw new Error(`manifest fetch failed: ${resp.status}`);
  const manifest = (await resp.json()) as StarsManifest;
  if (!Number.isFinite(manifest.count) || !Array.isArray(manifest.attributes)) {
    throw new Error('invalid stars manifest');
  }
  return manifest;
}

/** Fetch one attribute section via Range request, streaming progress. */
async function fetchSection(
  url: string,
  meta: AttributeMeta,
  onBytes: (delta: number) => void,
): Promise<Uint8Array> {
  const end = meta.byteOffset + meta.byteLength - 1;
  const resp = await fetch(url, { headers: { Range: `bytes=${meta.byteOffset}-${end}` } });
  if (!resp.ok && resp.status !== 206) {
    throw new Error(`section ${meta.name} fetch failed: ${resp.status}`);
  }
  const isPartial = resp.status === 206;
  const out = new Uint8Array(meta.byteLength);

  if (!resp.body) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    const view = isPartial ? buf : buf.subarray(meta.byteOffset, meta.byteOffset + meta.byteLength);
    out.set(view.subarray(0, meta.byteLength));
    onBytes(meta.byteLength);
    return out;
  }

  const reader = resp.body.getReader();
  let written = 0; // position within the section
  let streamPos = 0; // position within the response body (for 200 fallback)
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let chunk = value;
    if (!isPartial) {
      // Server ignored Range: skip bytes before the section, trim after it.
      const chunkStart = streamPos;
      streamPos += chunk.byteLength;
      const from = Math.max(meta.byteOffset - chunkStart, 0);
      if (from >= chunk.byteLength) continue;
      chunk = chunk.subarray(from);
    }
    const take = Math.min(chunk.byteLength, meta.byteLength - written);
    if (take <= 0) continue;
    out.set(chunk.subarray(0, take), written);
    written += take;
    onBytes(take);
  }
  if (written < meta.byteLength) {
    throw new Error(`section ${meta.name}: got ${written} of ${meta.byteLength} bytes`);
  }
  return out;
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
 */
export function loadStars(
  baseUrl: string,
  manifest: StarsManifest,
  onProgress: (fraction: number) => void = () => {},
): StarLoadHandle {
  const url = `${baseUrl}stars.bin`;
  const meta = Object.fromEntries(
    [...CORE_ATTRIBUTES, ...DETAIL_ATTRIBUTES].map((n) => [n, attributeMeta(manifest, n)]),
  ) as Record<(typeof CORE_ATTRIBUTES | typeof DETAIL_ATTRIBUTES)[number], AttributeMeta>;

  const coreTotal = CORE_ATTRIBUTES.reduce((s, n) => s + meta[n].byteLength, 0);
  let coreLoaded = 0;
  const onCoreBytes = (delta: number) => {
    coreLoaded += delta;
    onProgress(Math.min(coreLoaded / coreTotal, 1));
  };

  const coreSection = (n: (typeof CORE_ATTRIBUTES)[number]) =>
    fetchSection(url, meta[n], onCoreBytes);
  const detailSection = async (n: (typeof DETAIL_ATTRIBUTES)[number]) =>
    new Float32Array((await fetchSection(url, meta[n], () => {})).buffer);

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
      position: new Float32Array(position.buffer),
      colorRGB,
      sizeAbsMag: new Float32Array(sizeAbsMag.buffer),
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
