import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const repo = path.resolve(__dirname, '..', '..');

/**
 * Aliases resolve every @routier package to its SOURCE. The prebuilt dist bundles are
 * stale on machines without the rspack native binding, and a stress test of old code
 * measures nothing.
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
        ],
    },
    server: {
        port: 5199,
    },
});
