import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The docs playground, published at /playground/ (see docs/package.json). Like the Lab, it runs
 * against the built dist bundles, so run `npm run build` at the repo root first.
 */
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        exclude: [
            '@routier/core',
            '@routier/datastore',
            '@routier/memory-plugin',
            '@routier/dexie-plugin',
            '@routier/react',
        ],
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
