/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url));

/**
 * Serves the generated data artifacts (../data) at /data/* in dev and preview,
 * with HTTP Range support — the star loader fetches stars.bin per-section.
 * In production the same files are expected on the CDN under /data/.
 */
function serveDataDir(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/data/')) return next();
    const rel = decodeURIComponent(req.url.slice('/data/'.length).split('?')[0] ?? '');
    const file = path.resolve(DATA_DIR, rel);
    if (!file.startsWith(DATA_DIR) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const size = statSync(file).size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Type',
      file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    );
    const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.setHeader('Content-Length', size);
    createReadStream(file).pipe(res);
  };
  return {
    name: 'serve-data-dir',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveDataDir()],
  build: {
    // The default warning threshold measures UNcompressed bytes; our budget is
    // gzip (≤600 KB JS, SPEC §7) and is tracked in STATE.md by measurement. The
    // three vendor chunk is ~979 KB raw but ~260 KB gzip, so raise the limit to
    // silence a warning that doesn't reflect the budget we actually enforce.
    chunkSizeWarningLimit: 1000,
    // Split the rarely-changing 3D vendor (three + R3F + postprocessing) into
    // its own chunk so repeat visits cache it across app deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules') && /[\\/](three|@react-three|postprocessing)[\\/]/.test(id))
            return 'three';
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
