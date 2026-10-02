/**
 * Bundles the browser fixtures the way a web application would.
 *
 * Nothing is external here, unlike the library builds: this is the consumer, so it resolves
 * `@routier/sqlite-plugin` and `@routier/pglite-plugin` through the `browser` condition and
 * inlines what it finds. If that condition is missing or points at a Node build, this fails on
 * `node:sqlite` or on `pg` — which is itself the check.
 */
import { rspack } from '@rspack/core';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

rspack({
    entry: {
        bundle: resolve(here, 'app.js'),
        'pglite-bundle': resolve(here, 'pglite-app.js'),
    },
    output: {
        path: resolve(here, 'dist'),
        filename: '[name].js',
        module: true,
        chunkFormat: 'module',
        // PGlite loads its .wasm and .data at runtime through `new URL(..., import.meta.url)`,
        // so both have to be emitted next to the bundle under their own names.
        assetModuleFilename: '[name][ext]',
    },
    experiments: { outputModule: true },
    resolve: { extensions: ['.js', '.ts'], conditionNames: ['browser', 'import', 'default'] },
    target: 'web',
    mode: 'development',
    devtool: false,
}, (error, stats) => {
    if (error) {
        console.error(error);
        process.exit(1);
    }

    const info = stats.toJson({ errors: true, warnings: false });

    if (stats.hasErrors()) {
        console.error(info.errors.map(e => e.message).join('\n\n'));
        process.exit(1);
    }

    console.log('bundles built');
});
