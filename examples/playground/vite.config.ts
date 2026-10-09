import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The docs playground, published at /playground/ (see docs/package.json). Like the Lab, it runs
 * against the built dist bundles, so run `npm run build` at the repo root first.
 */
export default defineConfig({
    plugins: [react()],
    esbuild: { keepNames: true },
    optimizeDeps: {
        exclude: [
            '@routier/core',
            '@routier/datastore',
            '@routier/memory-plugin',
            '@routier/dexie-plugin',
            '@routier/react',
            '@routier/browser-storage-plugin',
            '@routier/sqlite-plugin',
            '@sqlite.org/sqlite-wasm',
            '@routier/postgres-plugin-core',
            '@routier/pglite-plugin',
            '@electric-sql/pglite',
        ],
    },
    worker: {
        format: 'es',
    },
    build: {
        chunkSizeWarningLimit: 4500,
    },
    server: {
        port: 5220,
    },
    preview: {
        port: 5221,
    },
});
