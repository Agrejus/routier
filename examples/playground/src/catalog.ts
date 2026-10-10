import crudSource from './examples/crud.ts?raw';
import liveQueriesSource from './examples/liveQueries.ts?raw';
import liveGridSource from './examples/LiveGrid.tsx?raw';
import reactTodosSource from './examples/ReactTodos.tsx?raw';
import persistentNotesSource from './examples/PersistentNotes.tsx?raw';
import sandboxSource from './examples/sandbox.ts?raw';
import localStorageSource from './examples/localStorage.ts?raw';
import sqliteSource from './examples/sqliteQueries.ts?raw';
import pgliteSource from './examples/pgliteQueries.ts?raw';

export type Example = {
    id: string;
    title: string;
    summary: string;
    file: string;
    source: string;
    kind: 'script' | 'component';
    wide?: boolean;
};

export const EXAMPLES: Example[] = [
    { id: 'sandbox', title: 'Sandbox', summary: 'A blank-slate store on the memory plugin. Change anything and press Run.', file: 'sandbox.ts', source: sandboxSource, kind: 'script' },
    { id: 'crud', title: 'Schemas & CRUD', summary: 'Define a schema, then add, query, update, and remove entities.', file: 'crud.ts', source: crudSource, kind: 'script' },
    { id: 'live-queries', title: 'Live queries', summary: 'Subscribe to a query and watch the result update as data changes.', file: 'liveQueries.ts', source: liveQueriesSource, kind: 'script' },
    {
        id: 'grid',
        title: 'Live data grid',
        summary: 'Search, sort, and page through products. The page is one live query, so turn on Simulate traffic and watch it refresh as rows change underneath it.',
        file: 'LiveGrid.tsx',
        source: liveGridSource,
        kind: 'component',
        wide: true,
    },
    { id: 'react', title: 'React + useQuery', summary: 'A todo list whose components re-render from live queries.', file: 'ReactTodos.tsx', source: reactTodosSource, kind: 'component' },
    { id: 'persistence', title: 'IndexedDB (Dexie)', summary: 'The same store API on the Dexie plugin. Reload the page and your notes are still there.', file: 'PersistentNotes.tsx', source: persistentNotesSource, kind: 'component' },
    { id: 'local-storage', title: 'localStorage', summary: 'A store kept in localStorage. Run it, reload the page, and run it again.', file: 'localStorage.ts', source: localStorageSource, kind: 'script' },
    { id: 'sqlite', title: 'SQLite (WASM)', summary: 'Real SQLite compiled to WebAssembly, running in your browser.', file: 'sqliteQueries.ts', source: sqliteSource, kind: 'script' },
    { id: 'pglite', title: 'PostgreSQL (PGlite)', summary: 'Real PostgreSQL compiled to WebAssembly. The first run downloads it, so give it a few seconds.', file: 'pgliteQueries.ts', source: pgliteSource, kind: 'script' },
];
