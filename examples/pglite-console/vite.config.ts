import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Runs against the built dist bundles rather than source aliases, for the same reason as the
 * db-migration example: the PGlite worker is emitted next to `dist/index.browser.js` and is
 * resolved relative to it. Run `npm run build` at the repository root first.
 */
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        // esbuild pre-bundling rewrites module URLs, which breaks
        // `new Worker(new URL('./pgliteWorker.js', import.meta.url))`.
        exclude: [
            '@routier/core',
            '@routier/datastore',
            '@routier/postgres-plugin-core',
            '@routier/pglite-plugin',
            // PGlite resolves its .wasm and .data relative to import.meta.url. Pre-bundled
            // into .vite/deps, that URL points at a missing file and the SPA fallback returns
            // index.html instead — the WASM loader then reports the bytes for "<!do".
            '@electric-sql/pglite',
        ],
    },
    worker: {
        // REQUIRED for PGlite. Vite bundles the worker it finds behind
        // `new Worker(new URL(...))`, and its default worker format is `iife`, which cannot
        // code-split. PGlite reaches its filesystems through dynamic imports, so the build
        // fails with "UMD and IIFE output formats are not supported for code-splitting
        // builds". An ES worker splits fine, and `{ type: 'module' }` is what the plugin asks
        // for anyway.
        format: 'es',
    },
    build: {
        // The compiled schema's generated code calls core helpers by their source names;
        // minification renames them and the schema fails to compile at runtime.
        minify: false,
    },
    server: {
        port: 5220,
    },
    preview: {
        port: 5221,
    },
});
