import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from './generate';
import type { ModuleLoader } from './generate';

const SCHEMA_SOURCE = 'import { s } from "@routier/core";\nexport const a = s.define("a", {}).compile();\n';

let cwd: string;

const addFile = (name: string, content = '') => {
    mkdirSync(join(cwd, name, '..'), { recursive: true });
    writeFileSync(join(cwd, name), content);
};

const compileUsers = () => {
    s.define('users', { id: s.string().key() }).compile();
};

const compileOrders = () => {
    s.define('orders', { id: s.number().key() }).compile();
};

const loadedFiles = () => {
    const loaded: string[] = [];
    const load: ModuleLoader = file => {
        loaded.push(file.slice(cwd.length + 1));
        compileUsers();

        return Promise.resolve();
    };

    return { loaded, load };
};

const run = (load: ModuleLoader, patterns: readonly string[] = ['schemas/*.ts'], out = 'gen') =>
    generate({ patterns, out }, cwd, load);

beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'routier-cli-'));
});

afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
});

describe('generate', () => {
    it('writes one file with every schema the loaded files compile', async () => {
        addFile('schemas/a.ts');
        addFile('schemas/b.ts');

        const result = await run(file => {
            (file.endsWith('a.ts') ? compileUsers : compileOrders)();

            return Promise.resolve();
        });

        expect(result).toEqual({ ok: true, schemas: ['orders', 'users'], file: join(cwd, 'gen/routier.generated.js'), skipped: [] });
        expect(readdirSync(join(cwd, 'gen')).sort()).toEqual(['routier.generated.d.ts', 'routier.generated.js']);
        expect(readFileSync(join(cwd, 'gen/routier.generated.js'), 'utf8')).toContain('": function(');
    });

    it('sets no recorder once it has finished', async () => {
        addFile('schemas/a.ts');

        await run(() => {
            compileUsers();

            return Promise.resolve();
        });

        expect(globalThis.__routierFunctionRecorder).toBeUndefined();
    });

    it('removes the recorder when a load fails', async () => {
        addFile('schemas/a.ts');

        await run(() => Promise.reject(new Error('broken')));

        expect(globalThis.__routierFunctionRecorder).toBeUndefined();
    });
});

const installPackage = (name: string) => {
    const folder = join(cwd, 'node_modules/@routier', name);

    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: `@routier/${name}`, main: './main.js' }));
    writeFileSync(join(folder, 'main.js'), '');

    return join(folder, 'main.js');
};

describe('installed Routier packages', () => {
    it('records the schemas a package compiles when it loads', async () => {
        const entry = installPackage('fake-sync');
        addFile('schemas/a.ts');

        const result = await run(file => {
            (file === entry ? compileOrders : compileUsers)();

            return Promise.resolve();
        });

        expect(result).toEqual({ ok: true, schemas: ['orders', 'users'], file: join(cwd, 'gen/routier.generated.js'), skipped: [] });
    });

    it('loads the packages while recording', async () => {
        const entry = installPackage('fake-store');
        const recording: boolean[] = [];

        addFile('schemas/a.ts');
        await run(file => {
            if (file === entry) {
                recording.push(globalThis.__routierFunctionRecorder != null);
            }

            compileUsers();

            return Promise.resolve();
        });

        expect(recording).toEqual([true]);
    });

    it('skips a package that cannot load, says why, and still writes the file', async () => {
        const entry = installPackage('fake-browser');
        addFile('schemas/a.ts');

        const result = await run(file => {
            if (file === entry) {
                return Promise.reject(new Error('localStorage is not defined'));
            }

            compileUsers();

            return Promise.resolve();
        });

        expect(result).toEqual({
            ok: true,
            schemas: ['users'],
            file: join(cwd, 'gen/routier.generated.js'),
            skipped: ['@routier/fake-browser: could not load it in Node: localStorage is not defined'],
        });
    });

    it('skips a package it cannot resolve', async () => {
        mkdirSync(join(cwd, 'node_modules/@routier/broken'), { recursive: true });
        addFile('schemas/a.ts');

        const result = await run(() => {
            compileUsers();

            return Promise.resolve();
        });

        expect(result.ok && result.skipped).toEqual([expect.stringMatching(/^@routier\/broken: could not load it in Node: .*Cannot find module '@routier\/broken'/)]);
    });
});

describe('naming files', () => {
    it.each(['a.ts', 'a.tsx', 'a.mts', 'a.cts', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs', 'a.d.tsx'])('loads %s', async name => {
        addFile(`schemas/${name}`);

        const { loaded, load } = loadedFiles();

        await run(load, ['schemas/*']);

        expect(loaded).toEqual([`schemas/${name}`]);
    });

    it.each(['notes.md', 'a.ts.bak', 'a.xts', 'ts', 'a.d.ts', 'a.d.mts', 'a.d.cts'])('skips %s', async name => {
        addFile(`schemas/${name}`);

        const { loaded, load } = loadedFiles();

        await run(load, ['schemas/*']);

        expect(loaded).toEqual([]);
    });

    it('loads a named file with no sign of a schema', async () => {
        addFile('schemas/reexported.ts', 'export const nothing = 1;');

        const { loaded, load } = loadedFiles();

        await run(load);

        expect(loaded).toEqual(['schemas/reexported.ts']);
    });

    it('loads a file once when two patterns match it', async () => {
        addFile('schemas/a.ts');

        const { loaded, load } = loadedFiles();

        await run(load, ['schemas/*.ts', 'schemas/a.ts']);

        expect(loaded).toEqual(['schemas/a.ts']);
    });

    it('skips a folder whose name looks like a script', async () => {
        mkdirSync(join(cwd, 'schemas/folder.ts'), { recursive: true });

        const { loaded, load } = loadedFiles();

        await run(load, ['schemas/*']);

        expect(loaded).toEqual([]);
    });

    it('skips node_modules', async () => {
        addFile('node_modules/dep/a.ts');
        addFile('a.ts');

        const { loaded, load } = loadedFiles();

        await run(load, ['**/*.ts']);

        expect(loaded).toEqual(['a.ts']);
    });

    it('skips its own output', async () => {
        addFile('gen/routier.generated.js');
        addFile('gen/other.js');

        const { loaded, load } = loadedFiles();

        await run(load, ['gen/*.js']);

        expect(loaded).toEqual(['gen/other.js']);
    });
});

describe('scanning src', () => {
    it.each([
        ['a schema', 'src/users.ts', SCHEMA_SOURCE],
        ['a nested schema', 'src/deep/er/users.ts', SCHEMA_SOURCE],
        ['a file named like a test, but with another extension', 'src/a.test.tsx.ts', SCHEMA_SOURCE],
        ['a compile on its own line', 'src/users.ts', 'import { s } from "@routier/core";\nconst a = s.define("a", {})\n  .compile ();\n'],
    ])('loads %s', async (_label, name, content) => {
        addFile(name, content);

        const { loaded, load } = loadedFiles();

        await run(load, []);

        expect(loaded).toEqual([name]);
    });

    it.each([
        ['a file with no compile', 'src/a.ts', 'import { s } from "@routier/core";'],
        ['a file that compiles something else', 'src/a.ts', 'template.compile("x");'],
        ['a test file', 'src/a.test.ts', SCHEMA_SOURCE],
        ['a spec file', 'src/a.spec.tsx', SCHEMA_SOURCE],
        ['a module test file', 'src/a.test.mts', SCHEMA_SOURCE],
        ['a file outside src', 'other/a.ts', SCHEMA_SOURCE],
    ])('skips %s', async (_label, name, content) => {
        addFile(name, content);

        const { loaded, load } = loadedFiles();

        await run(load, []);

        expect(loaded).toEqual([]);
    });

    it('rewrites its output in src without loading it', async () => {
        addFile('src/users.ts', SCHEMA_SOURCE);
        addFile('src/routier.generated.js', SCHEMA_SOURCE);

        const { loaded, load } = loadedFiles();
        const result = await run(load, [], 'src');

        expect(loaded).toEqual(['src/users.ts']);
        expect(result).toMatchObject({ ok: true, file: join(cwd, 'src/routier.generated.js') });
    });
});

describe('problems', () => {
    it('reports when no files match', async () => {
        expect(await run(() => Promise.resolve())).toEqual({
            ok: false,
            problems: ['Found no compiled schemas in 0 files.'],
        });
        expect(existsSync(join(cwd, 'gen'))).toBe(false);
    });

    it('reports when files compile no schemas', async () => {
        addFile('schemas/a.ts');

        expect(await run(() => Promise.resolve())).toEqual({
            ok: false,
            problems: ['Found no compiled schemas in 1 files.'],
        });
    });

    it('reports a file that fails to load, with the reason, and writes nothing', async () => {
        addFile('schemas/a.ts');

        const result = await run(() => {
            compileUsers();

            return Promise.reject(new Error('window is not defined'));
        });

        expect(result).toEqual({
            ok: false,
            problems: [`${join(cwd, 'schemas/a.ts')}: could not load the file: window is not defined`],
        });
        expect(existsSync(join(cwd, 'gen'))).toBe(false);
    });

    it('reports a file that throws something other than an Error', async () => {
        addFile('schemas/a.ts');

        const result = await run(() => Promise.reject('plain text'));

        expect(result).toMatchObject({ ok: false, problems: [expect.stringContaining('could not load the file: plain text')] });
    });

    it('reports every problem at once', async () => {
        addFile('schemas/a.ts');
        addFile('schemas/b.ts');

        const result = await run(() => Promise.reject(new Error('broken')));

        expect(result).toMatchObject({ ok: false, problems: [expect.any(String), expect.any(String)] });
    });
});
