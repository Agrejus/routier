import { createRequire } from "node:module";
import { resolve } from "node:path";

/**
 * One build definition for every publishable package.
 *
 * Each package previously carried its own copy of this, and the copies had drifted into two
 * incompatible halves. Six emitted ESM while declaring `"type": "commonjs"`, so `require()`
 * threw `ERR_REQUIRE_ESM` on any Node without `require(esm)` — Node 18 and 20, both inside the
 * supported range the READMEs state. The other six emitted `commonjs2`, which Node's ESM
 * interop exposes only as a default export, so the `import { MysqlDbPlugin } from ...` written
 * in their own READMEs returned `undefined`.
 *
 * Every package now emits both formats and declares them through `exports`, so either module
 * system resolves the matching file.
 *
 * Dependencies are external. `@routier/core` is a peerDependency of all eleven plugins, which
 * is a promise not to bundle it, and every bundle bundled it anyway — a consumer of the
 * datastore and two plugins loaded three separate copies. Externalising also keeps a driver's
 * own conditional exports intact: bundling `pouchdb` under `target: "web"` inlined its browser
 * build, and the result threw `self is not defined` on import in Node.
 */

/** Node built-ins, which are never bundled regardless of how they are imported. */
const NODE_BUILTINS = [
    "assert", "buffer", "child_process", "crypto", "events", "fs", "fs/promises", "http",
    "https", "net", "os", "path", "perf_hooks", "stream", "string_decoder", "timers", "tls",
    "url", "util", "worker_threads", "zlib",
];

/**
 * Every package name the manifest says the consumer supplies.
 *
 * Matched on the package name and on any subpath, so `@routier/core/schema` is external for
 * the same reason `@routier/core` is.
 */
const externalPackages = (manifest) => [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...NODE_BUILTINS,
];

const externalsFor = (manifest) => {
    const names = externalPackages(manifest);

    return ({ request }, callback) => {
        const isExternal = names.some(
            name => request === name || request.startsWith(`${name}/`)
        );

        if (isExternal) {
            return callback(null, request);
        }

        return callback();
    };
};

const swcRule = {
    test: /\.tsx?$/,
    use: {
        // Rspack ships this loader with its native binding. ts-loader would require webpack
        // itself as a peer and makes an otherwise-Rspack-only package fail to build in a
        // clean workspace.
        loader: "builtin:swc-loader",
        options: {
            jsc: {
                parser: { syntax: "typescript", tsx: true },
                target: "es2022",
            },
        },
    },
    exclude: [/node_modules/, /\.test\.tsx?$/],
};

/**
 * Build definitions for one package: ESM at `dist/index.js`, CommonJS at `dist/index.cjs`.
 *
 * Neither config sets `output.clean`. The two run in parallel, so a clean in either one races
 * the other's output. `scripts/clean-dist.mjs` runs once before both instead.
 *
 * @param {object} options
 * @param {string} options.dirname   The package directory, from `import.meta.url`.
 * @param {"web"|"node"} [options.target]  `node` for packages that need a Node built-in to
 *                                          exist. Both targets externalise the same modules.
 * @param {Record<string,string>} [options.entry]  Entry map for packages that publish
 *                                          subpaths. `@routier/core` has thirteen.
 */
export function libraryConfig({ dirname, target = "web", entry = { index: "./src/index.ts" } }) {
    const require = createRequire(import.meta.url);
    const manifest = require(resolve(dirname, "package.json"));
    const externals = externalsFor(manifest);

    const shared = {
        entry,
        module: { rules: [swcRule] },
        resolve: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
        externals,
        target,
        // Production, unlike every config this replaces, which shipped the full development
        // module map. Nearly all of the size win comes from externalising dependencies
        // rather than from minification, which is off — see below.
        mode: "production",
        optimization: {
            // Routier compiles schemas by generating source at runtime. `SchemaDefinition`
            // embeds `createChangeTracker.toString()` into that source and then emits a call
            // to `createChangeTracker()` written as a literal string. A minifier renames the
            // declaration and cannot see the call, so the generated function throws
            // "createChangeTracker is not defined" the first time any schema is compiled.
            //
            // Every config this replaces used `mode: "development"`, which avoided the
            // problem by accident. Turning minification off states the constraint instead.
            // Removing this needs the codegen to stop depending on identifier names —
            // see `specs/known-defects.md`.
            minimize: false,
        },
        devtool: "source-map",
    };

    return [
        {
            ...shared,
            name: "esm",
            output: {
                path: resolve(dirname, "dist"),
                filename: "[name].js",
                library: { type: "module" },
                chunkFormat: "module",
            },
            externalsType: "module-import",
            experiments: { outputModule: true },
        },
        {
            ...shared,
            name: "cjs",
            output: {
                path: resolve(dirname, "dist"),
                filename: "[name].cjs",
                library: { type: "commonjs2" },
                chunkFormat: "commonjs",
            },
            externalsType: "commonjs",
        },
    ];
}
