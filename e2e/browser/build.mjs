/**
 * Bundles the browser fixture the way a web application would.
 *
 * Nothing is external here, unlike the library builds: this is the consumer, so it resolves
 * `@routier/sqlite-plugin` through the `browser` condition and inlines what it finds. If that
 * condition is missing or points at the Node build, this build fails on `node:sqlite` — which
 * is itself the check.
 */
import { rspack } from '@rspack/core';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

rspack({
    entry: resolve(here, 'app.js'),
    output: { path: here, filename: 'bundle.js', module: true, chunkFormat: 'module' },
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

    console.log('bundle built');
});
