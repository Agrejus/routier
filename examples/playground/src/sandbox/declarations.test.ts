import { describe, expect, it } from '@jest/globals';
import { declarationsFor, type PackageDeclarations } from './declarations';

const core: PackageDeclarations = {
    name: '@routier/core',
    entry: 'index',
    subpaths: { schema: 'schema/index' },
    files: {
        'index.d.ts': "export * from './schema';\nimport type { Options } from 'zod';",
        'schema/index.d.ts': "export declare const s: number;\nimport Dexie from 'dexie';",
    },
};

const sqlite: PackageDeclarations = {
    name: '@routier/sqlite-plugin',
    entry: 'index.browser',
    subpaths: {},
    files: { 'index.browser.d.ts': "import type { Database } from '@sqlite.org/sqlite-wasm';\nimport { s } from '@routier/core/schema';\nimport { DataStore } from '@routier/core';\nimport type { FC } from 'react';\nimport type { Options }  from   'uuid';" },
};

const byPath = (packages: PackageDeclarations[]) => new Map(declarationsFor(packages, ['react']).map(file => [file.path, file.content]));

describe('declarationsFor', () => {
    it('places each package file under node_modules', () => {
        expect(byPath([core]).get('file:///node_modules/@routier/core/dist/schema/index.d.ts')).toContain('export declare const s');
    });

    it('points the package root at its entry declarations', () => {
        expect(byPath([sqlite]).get('file:///node_modules/@routier/sqlite-plugin/index.d.ts')).toBe('export * from "./dist/index.browser";\n');
    });

    it('adds a stub for each subpath export', () => {
        expect(byPath([core]).get('file:///node_modules/@routier/core/schema/index.d.ts')).toBe('export * from "../dist/schema/index";\n');
    });

    it('declares every module the packages import but do not ship, once', () => {
        const ambient = byPath([core, sqlite]).get('file:///node_modules/@types/playground-externals/index.d.ts');

        expect(ambient).toBe('declare module "@sqlite.org/sqlite-wasm";\ndeclare module "dexie";\ndeclare module "uuid";\ndeclare module "zod";\n');
    });
});
