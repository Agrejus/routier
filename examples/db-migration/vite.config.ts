import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * This example runs against the built dist bundles (not source aliases) because the
 * SQLite plugin's OPFS worker is emitted next to dist/index.browser.js and is resolved
 * relative to it. Run `npm run build` at the repo root first.
 */
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        // esbuild pre-bundling rewrites module URLs, which breaks the sqlite plugin's
        // `new Worker(new URL('./wasmWorker.js', import.meta.url))` resolution.
        exclude: [
            '@routier/core',
            '@routier/datastore',
            '@routier/memory-plugin',
            '@routier/browser-storage-plugin',
            '@routier/dexie-plugin',
            '@routier/pouchdb-plugin',
            '@routier/sqlite-plugin',
            // sqlite-wasm resolves sqlite3.wasm relative to import.meta.url. If Vite
            // pre-bundles it into .vite/deps, that relative URL points at a missing file
            // and the SPA fallback returns index.html ("expected magic word 00 61 73 6d,
            // found 3c 21 64 6f" — the bytes for "<!do").
            '@sqlite.org/sqlite-wasm',
            '@routier/postgres-plugin-core',
            '@routier/pglite-plugin',
            // Same failure mode as sqlite-wasm: PGlite resolves its .wasm and .data
            // relative to import.meta.url.
            '@electric-sql/pglite',
            '@routier/react',
        ],
    },
    worker: {
        // Required for PGlite: it reaches its filesystems through dynamic imports, and
        // Vite's default `iife` worker format cannot code-split, so the build fails.
        format: 'es',
    },
    build: {
        // The compiled schema's generated code calls core helpers by their source names;
        // minification renames them and the schema fails to compile at runtime.
        minify: false,
    },
    server: {
        port: 5210,
    },
    preview: {
        port: 5211,
    },
});
