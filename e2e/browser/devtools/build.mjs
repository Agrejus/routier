import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
export const outDir = resolve(here, 'build');

const coreSubpaths = ['schema', 'plugins', 'transfer', 'results', 'collections', 'expressions', 'utilities',
    'performance', 'pipeline', 'assertions', 'errors', 'types'];

const alias = {
    '@routier/core': resolve(repo, 'core/src/index.ts'),
    ...Object.fromEntries(coreSubpaths.map(name => [`@routier/core/${name}`, resolve(repo, `core/src/${name}/index.ts`)])),
    '@routier/datastore': resolve(repo, 'datastore/src/index.ts'),
    '@routier/memory-plugin': resolve(repo, 'plugins/memory/src/index.ts'),
    '@routier/devtools': resolve(repo, 'plugins/devtools/src/index.ts'),
};

const page = `<!doctype html>
<meta charset="utf-8">
<title>routier devtools smoke test</title>
<style>body { color: red; font-family: serif; } button { all: unset; }</style>
<script type="module" src="./app.js"></script>
`;

export const buildSmokeTest = async () => {
    await mkdir(outDir, { recursive: true });
    await build({
        entryPoints: [resolve(here, 'app.ts')],
        outfile: resolve(outDir, 'app.js'),
        bundle: true,
        format: 'esm',
        target: 'es2022',
        alias,
        jsx: 'automatic',
        jsxImportSource: 'preact',
        define: { 'process.env.NODE_ENV': '"development"' },
        logLevel: 'error',
    });
    await writeFile(resolve(outDir, 'index.html'), page);
    return outDir;
};
