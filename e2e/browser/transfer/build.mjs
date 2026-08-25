/**
 * Bundles the harness, the worker, and the pages it is served from.
 *
 * esbuild rather than the package's own rspack build, for two reasons: this bundles from SOURCE so
 * a run needs no `npm run build` first, and it INLINES `@sqlite.org/sqlite-wasm`, which the
 * published build deliberately externalises.
 *
 * The worker is built as its own entry and handed to the driver through `workerUrl`. That skips
 * bundler worker-detection entirely — the published path resolves
 * `new URL('./wasmWorker.js', import.meta.url)`, which every bundler spells differently and none
 * of which is what is under test here.
 */
import { build } from 'esbuild';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
export const outDir = resolve(here, 'build');

/** Workspace packages resolved to source, matching what jest and `tsconfig.check.json` do. */
const alias = {
    '@routier/core': resolve(repo, 'core/src/index.ts'),
    '@routier/core/schema': resolve(repo, 'core/src/schema/index.ts'),
    '@routier/core/plugins': resolve(repo, 'core/src/plugins/index.ts'),
    '@routier/core/transfer': resolve(repo, 'core/src/transfer/index.ts'),
    '@routier/core/results': resolve(repo, 'core/src/results/index.ts'),
    '@routier/core/collections': resolve(repo, 'core/src/collections/index.ts'),
    '@routier/core/expressions': resolve(repo, 'core/src/expressions/index.ts'),
    '@routier/core/utilities': resolve(repo, 'core/src/utilities/index.ts'),
    '@routier/core/performance': resolve(repo, 'core/src/performance/index.ts'),
    '@routier/core/pipeline': resolve(repo, 'core/src/pipeline/index.ts'),
    '@routier/core/assertions': resolve(repo, 'core/src/assertions/index.ts'),
    '@routier/core/errors': resolve(repo, 'core/src/errors/index.ts'),
    '@routier/core/types': resolve(repo, 'core/src/types/index.ts'),
    '@routier/datastore': resolve(repo, 'datastore/src/index.ts'),
    '@routier/sql-plugin-core': resolve(repo, 'plugins/sql-core/src/index.ts'),
    '@routier/postgres-plugin-core': resolve(repo, 'plugins/postgres-core/src/index.ts'),
};

const common = {
    bundle: true,
    format: 'esm',
    target: 'es2022',
    alias,
    logLevel: 'error',
};

/**
 * A page that loads the harness.
 *
 * `csp` adds a policy WITHOUT `unsafe-eval`, which is what makes `new Function` throw — the
 * condition the codec's fallback exists for, and one that cannot be simulated in Node.
 */
const page = (script, csp) => `<!doctype html>
<meta charset="utf-8">
${csp ? `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'wasm-unsafe-eval'">` : ''}
<title>routier sqlite browser harness</title>
<script type="module" src="./${script}"></script>
`;

export const buildHarness = async () => {
    await mkdir(outDir, { recursive: true });

    await build({
        ...common,
        entryPoints: [resolve(here, 'harness.ts')],
        outfile: resolve(outDir, 'harness.js'),
    });

    await build({
        ...common,
        entryPoints: [resolve(repo, 'plugins/sqlite/src/drivers/wasmWorker.ts')],
        outfile: resolve(outDir, 'worker.js'),
    });

    // sqlite3InitModule fetches this relative to the script that loaded it.
    await cp(
        resolve(repo, 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'),
        resolve(outDir, 'sqlite3.wasm')
    );

    await build({
        ...common,
        entryPoints: [resolve(here, 'cspProbe.ts')],
        outfile: resolve(outDir, 'cspProbe.js'),
    });

    await build({
        ...common,
        entryPoints: [resolve(here, 'dissectWorker.ts')],
        outfile: resolve(outDir, 'dissectWorker.js'),
    });

    // PGlite fetches these at runtime, relative to the script that loaded it.
    for (const asset of ['pglite.wasm', 'pglite.data', 'initdb.wasm']) {
        await cp(resolve(repo, `node_modules/@electric-sql/pglite/dist/${asset}`), resolve(outDir, asset));
    }

    for (const entry of ['pgliteProbe', 'pgliteLeader', 'pgliteCodecWorker', 'pgliteEndToEnd']) {
        await build({
            ...common,
            entryPoints: [resolve(here, `${entry}.ts`)],
            outfile: resolve(outDir, `${entry}.js`),
        });
    }

    // The plugin's own worker, built as its own ENTRY. A re-export shim would not do: the pglite
    // package declares `sideEffects: false`, so esbuild drops a side-effect-only import of it and
    // emits an empty file — which loads fine and then never answers the handshake.
    await build({
        ...common,
        entryPoints: [resolve(repo, 'plugins/pglite/src/pgliteWorker.ts')],
        outfile: resolve(outDir, 'pgliteRealWorker.js'),
    });

    await writeFile(resolve(outDir, 'pglite.html'), page('pgliteProbe.js', false));
    await writeFile(resolve(outDir, 'pgliteEndToEnd.html'), page('pgliteEndToEnd.js', false));
    await writeFile(resolve(outDir, 'index.html'), page('harness.js', false));
    // The full harness under CSP too, to record how far it gets.
    await writeFile(resolve(outDir, 'csp.html'), page('harness.js', true));
    await writeFile(resolve(outDir, 'cspProbe.html'), page('cspProbe.js', true));

    return outDir;
};

if (import.meta.url === `file://${process.argv[1]}`) {
    await buildHarness();
    console.log(`built -> ${outDir}`);
}
