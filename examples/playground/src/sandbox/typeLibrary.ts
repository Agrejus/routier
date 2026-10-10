import { declarationsFor, type DeclarationFile, type PackageDeclarations } from './declarations';
import devtoolsSource from '../devtools.ts?raw';
import reactIndex from '../../../../node_modules/@types/react/index.d.ts?raw';
import reactGlobal from '../../../../node_modules/@types/react/global.d.ts?raw';
import reactJsxRuntime from '../../../../node_modules/@types/react/jsx-runtime.d.ts?raw';
import csstype from '../../../../node_modules/csstype/index.d.ts?raw';

type Globbed = Record<string, string>;

const DIST = /^.*?\/dist\//;

const filesUnder = (globbed: Globbed): Record<string, string> =>
    Object.fromEntries(Object.entries(globbed).map(([path, content]) => [path.replace(DIST, ''), content]));

const CORE_SUBPATHS = ['assertions', 'collections', 'errors', 'expressions', 'performance', 'pipeline', 'plugins', 'results', 'schema', 'transfer', 'types', 'utilities'];

const PACKAGES: PackageDeclarations[] = [
    {
        name: '@routier/core',
        entry: 'index',
        subpaths: Object.fromEntries(CORE_SUBPATHS.map(subpath => [subpath, `${subpath}/index`])),
        files: filesUnder(import.meta.glob('../../../../core/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })),
    },
    { name: '@routier/datastore', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../datastore/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/react', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/react/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/memory-plugin', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/memory/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/browser-storage-plugin', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/browser-storage/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/dexie-plugin', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/dexie/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/sqlite-plugin', entry: 'index.browser', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/sqlite/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/sql-plugin-core', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/sql-core/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    { name: '@routier/postgres-plugin-core', entry: 'index', subpaths: {}, files: filesUnder(import.meta.glob('../../../../plugins/postgres-core/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })) },
    {
        name: '@routier/pglite-plugin',
        entry: 'index.browser',
        subpaths: { 'browser-storage': 'browserStorage' },
        files: filesUnder(import.meta.glob('../../../../plugins/pglite/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })),
    },
    {
        name: '@routier/devtools',
        entry: 'index',
        subpaths: { production: 'production' },
        files: filesUnder(import.meta.glob('../../../../plugins/devtools/dist/**/*.d.ts', { query: '?raw', import: 'default', eager: true })),
    },
];

const SHIPPED = ['react', 'csstype'];

export const typeLibrary = (): DeclarationFile[] => [
    ...declarationsFor(PACKAGES, SHIPPED),
    { path: 'file:///node_modules/@types/react/index.d.ts', content: reactIndex },
    { path: 'file:///node_modules/@types/react/global.d.ts', content: reactGlobal },
    { path: 'file:///node_modules/@types/react/jsx-runtime.d.ts', content: reactJsxRuntime },
    { path: 'file:///node_modules/csstype/index.d.ts', content: csstype },
    { path: 'file:///src/devtools.ts', content: devtoolsSource },
];
