import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildSync } from 'esbuild';

const repo = resolve(__dirname, '../..');
const NO_EVAL = '--disallow-code-generation-from-strings';
const GENERATED = 'import "./src/routier.generated.js";';
const SCHEMA_IMPORT = 'import { things } from "./src/schemas/things";';

const SCHEMA = `
import { s } from "@routier/core";

const prefix = "label-";

export const things = s.define("things", {
    id: s.string().key().identity(),
    name: s.string(),
    nested: s.object({ a: s.string() }),
    tags: s.string().array(),
    label: s.string().default(() => prefix + "default"),
}).modify(x => ({
    upper: x.computed(entity => entity.name.toUpperCase()),
})).compile();
`;

const UNEXPORTED_SCHEMA = `
import { s } from "@routier/core";

const hidden = s.define("hidden", { id: s.string().key() }).compile();

export const hiddenId = (id: string) => hidden.getId({ id });
`;

const PLUGIN = `
import { s } from "@routier/core";

const queue = s.define("plugin_queue", { id: s.string().key(), label: s.string() }).compile();

export const queued = (id) => queue.clone({ id, label: "queued" });
`;

const useSchema = (imports: string) => `
${imports}
const entity = things.enrich({ id: "a", name: "x", nested: { a: "one" }, tags: ["t"] }, "diff");
console.log(JSON.stringify({ entity, clone: things.clone(entity), id: things.getId(entity) }));
`;

const EXPECTED = {
    id: 'a',
    name: 'x',
    nested: { a: 'one' },
    tags: ['t'],
    label: 'label-default',
    upper: 'X',
};

let cwd: string;

const runCli = (...args: string[]) => spawnSync(join(repo, 'node_modules/.bin/tsx'), [join(repo, 'cli/src/index.ts'), ...args], {
    cwd,
    encoding: 'utf8',
});

const runBundled = (name: string, source: string) => {
    const entry = join(cwd, `${name}.ts`);
    const outfile = join(cwd, `${name}.mjs`);

    writeFileSync(entry, source);
    buildSync({
        entryPoints: [entry],
        outfile,
        bundle: true,
        minify: true,
        format: 'esm',
        platform: 'node',
        logLevel: 'silent',
    });

    return spawnSync(process.execPath, [NO_EVAL, outfile], { encoding: 'utf8' });
};

const installCore = () => {
    const folder = join(cwd, 'node_modules/@routier/core');

    buildSync({
        entryPoints: [join(repo, 'core/src/index.ts')],
        outfile: join(folder, 'index.js'),
        bundle: true,
        format: 'esm',
        platform: 'node',
        logLevel: 'silent',
    });
    writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: '@routier/core', type: 'module', main: './index.js' }));
};

const installPackage = (name: string, source: string) => {
    const folder = join(cwd, 'node_modules/@routier', name);

    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'index.js'), source);
    writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: `@routier/${name}`, type: 'module', main: './index.js' }));

    return folder;
};

beforeAll(() => {
    cwd = mkdtempSync(join(tmpdir(), 'routier-cli-acceptance-'));
    mkdirSync(join(cwd, 'src/schemas'), { recursive: true });
    installCore();
    installPackage('fake-plugin', PLUGIN);
    writeFileSync(join(cwd, 'src/schemas/things.ts'), SCHEMA);
    writeFileSync(join(cwd, 'src/schemas/hidden.ts'), UNEXPORTED_SCHEMA);
    writeFileSync(join(cwd, 'src/schemas/things.test.ts'), 'import "@routier/core"; x.compile(); describe("never loaded", () => {});');
    writeFileSync(join(cwd, 'src/main.ts'), 'throw new Error("the app ran");');
});

afterAll(() => {
    rmSync(cwd, { recursive: true, force: true });
});

describe('routier generate', () => {
    it('finds schemas with no arguments, without running the app or its tests', () => {
        const generated = runCli('generate');

        expect(generated.stderr).toBe('');
        expect(generated.status).toBe(0);
        expect(generated.stdout).toContain('Generated hidden, plugin_queue, things in');
        expect(generated.stdout).toContain('routier.generated.js');
    }, 60000);

    it('runs an unchanged .compile() in a minified bundle with eval blocked', () => {
        const run = runBundled('app', useSchema(`${GENERATED}\n${SCHEMA_IMPORT}`));

        expect(run.stderr).toBe('');
        expect(run.status).toBe(0);
        expect(JSON.parse(run.stdout)).toEqual({ entity: EXPECTED, clone: EXPECTED, id: 'a' });
    }, 60000);

    it('runs a schema that is not exported, with eval blocked', () => {
        const run = runBundled('hidden', `
            ${GENERATED}
            import { hiddenId } from "./src/schemas/hidden";
            console.log(hiddenId("a"));
        `);

        expect(run.stderr).toBe('');
        expect(run.stdout.trim()).toBe('a');
    }, 60000);

    it('runs a schema an installed Routier package compiles, with eval blocked', () => {
        const run = runBundled('plugin', `
            ${GENERATED}
            import { queued } from "@routier/fake-plugin";
            console.log(JSON.stringify(queued("a")));
        `);

        expect(run.stderr).toBe('');
        expect(JSON.parse(run.stdout)).toEqual({ id: 'a', label: 'queued' });
    }, 60000);

    it('skips an installed Routier package that cannot load in Node, and says so', () => {
        const folder = installPackage('browser-only', 'throw new Error("indexedDB is not defined");');

        try {
            const result = runCli('generate', '--out', 'skipped-output');

            expect(result.status).toBe(0);
            expect(result.stderr).toContain('Skipped @routier/browser-only: could not load it in Node: indexedDB is not defined');
            expect(result.stdout).toContain('Generated hidden, plugin_queue, things in');
        } finally {
            rmSync(folder, { recursive: true, force: true });
        }
    }, 60000);

    it('names the fix when the generated file is not imported', () => {
        const run = runBundled('missing', useSchema(SCHEMA_IMPORT));

        expect(run.status).not.toBe(0);
        expect(run.stderr).toContain(`The schema 'things' has no generated function.`);
    }, 60000);

    it('names the fix when the generated file is imported too late', () => {
        const run = runBundled('late', useSchema(`${SCHEMA_IMPORT}\n${GENERATED}`));

        expect(run.status).not.toBe(0);
        expect(run.stderr).toContain('import the generated file before your schemas');
    }, 60000);

    it('needs nothing generated when eval is allowed', () => {
        const entry = join(cwd, 'allowed.ts');
        const outfile = join(cwd, 'allowed.mjs');

        writeFileSync(entry, useSchema(SCHEMA_IMPORT));
        buildSync({ entryPoints: [entry], outfile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });

        const run = spawnSync(process.execPath, [outfile], { encoding: 'utf8' });

        expect(run.stderr).toBe('');
        expect(JSON.parse(run.stdout)).toEqual({ entity: EXPECTED, clone: EXPECTED, id: 'a' });
    }, 60000);

    it('writes no eval into the generated file', () => {
        const generated = readFileSync(join(cwd, 'src/routier.generated.js'), 'utf8');

        expect(generated).not.toMatch(/\beval\(|new Function\(/);
    });

    it('names the file when a schema file fails to load', () => {
        writeFileSync(join(cwd, 'broken.ts'), 'throw new Error("window is not defined");');

        const result = runCli('generate', 'broken.ts', '--out', 'broken-output');

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('could not load the file: window is not defined');
    }, 60000);

    it('shows usage and fails for a bad command', () => {
        const result = runCli('build');

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Unknown command: build.');
        expect(result.stderr).toContain('Usage: routier generate');
    }, 60000);

    it('shows usage for --help', () => {
        const result = runCli('--help');

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Usage: routier generate');
    }, 60000);
});
