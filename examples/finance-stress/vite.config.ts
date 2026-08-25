import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const repo = path.resolve(__dirname, '..', '..');

/**
 * Source for everything that has no worker; DIST for the two that do.
 *
 * Source is the default because a stress test of stale code measures nothing. But the SQLite and
 * PGlite plugins spawn workers with `new Worker(new URL('./wasmWorker.js', import.meta.url))`,
 * and that URL resolves relative to the file CONTAINING it. From source there is no built worker
 * beside it and the app 404s at runtime. Their dist bundles are laid out so it resolves, which is
 * also the artifact a consumer gets — so the worker-backed paths here test what actually ships.
 *
 * Run `npm run build` at the repository root before using `?plugin=sqlite` or `?plugin=pglite`.
 *
 * Mixing is safe: both plugin bundles keep `@routier/core` external, so the alias below resolves
 * it to source for them too and there is exactly one core in the app.
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            { find: /^@routier\/core\/(.*)$/, replacement: path.resolve(repo, 'core/src/$1') },
            { find: /^@routier\/core$/, replacement: path.resolve(repo, 'core/src/index.ts') },
            { find: /^@routier\/datastore$/, replacement: path.resolve(repo, 'datastore/src/index.ts') },
            { find: /^@routier\/memory-plugin$/, replacement: path.resolve(repo, 'plugins/memory/src/index.ts') },
            { find: /^@routier\/react$/, replacement: path.resolve(repo, 'react/src/index.ts') },
            // dist, deliberately — see the note above.
            { find: /^@routier\/sqlite-plugin$/, replacement: path.resolve(repo, 'plugins/sqlite/dist/index.browser.js') },
            { find: /^@routier\/pglite-plugin$/, replacement: path.resolve(repo, 'plugins/pglite/dist/index.browser.js') },
            { find: /^@routier\/postgres-plugin-core$/, replacement: path.resolve(repo, 'plugins/postgres-core/src/index.ts') },
            { find: /^@routier\/sql-plugin-core$/, replacement: path.resolve(repo, 'plugins/sql-core/src/index.ts') },
        ],
    },
    optimizeDeps: {
        // esbuild pre-bundling rewrites module URLs, which breaks
        // `new Worker(new URL(..., import.meta.url))` and the engines' own .wasm lookups.
        exclude: ['@sqlite.org/sqlite-wasm', '@electric-sql/pglite'],
    },
    worker: {
        // PGlite reaches its filesystems through dynamic imports, and Vite's default `iife`
        // worker format cannot code-split. An ES worker splits fine and is what both plugins ask
        // for anyway.
        format: 'es',
    },
    build: {
        // The compiled schema's generated code calls core helpers by their source names;
        // minification renames them and the schema fails to compile at runtime.
        minify: false,
    },
    server: {
        port: 5199,
    },
});
