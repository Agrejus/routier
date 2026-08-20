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
            '@routier/dexie-plugin',
            '@routier/pouchdb-plugin',
            '@routier/sqlite-plugin',
            '@routier/react',
        ],
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
