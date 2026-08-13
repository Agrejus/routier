import { defineConfig } from 'vite';
import path from 'node:path';

const repo = path.resolve(__dirname, '..', '..');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@routier\/core\/(.*)$/, replacement: path.resolve(repo, 'core/src/$1') },
      { find: /^@routier\/core$/, replacement: path.resolve(repo, 'core/src/index.ts') },
      { find: /^@routier\/datastore$/, replacement: path.resolve(repo, 'datastore/src/index.ts') },
      { find: /^@routier\/react$/, replacement: path.resolve(repo, 'react/src/index.ts') },
      { find: /^@routier\/memory-plugin$/, replacement: path.resolve(repo, 'plugins/memory/src/index.ts') },
      { find: /^@routier\/browser-storage-plugin$/, replacement: path.resolve(repo, 'plugins/browser-storage/src/index.ts') },
      { find: /^@routier\/dexie-plugin$/, replacement: path.resolve(repo, 'plugins/dexie/src/index.ts') },
      { find: /^@routier\/pouchdb-plugin$/, replacement: path.resolve(repo, 'plugins/pouchdb/src/index.ts') },
      { find: /^@routier\/replication-plugin$/, replacement: path.resolve(repo, 'plugins/replication/src/index.ts') },
      { find: /^@routier\/file-system-plugin$/, replacement: path.resolve(repo, 'plugins/file-system/src/index.ts') },
    ],
  },
  build: { outDir: 'dist' },
});
