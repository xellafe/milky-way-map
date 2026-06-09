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
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
