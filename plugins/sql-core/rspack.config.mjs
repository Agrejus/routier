import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspack/cli";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pure TypeScript, no native modules — so unlike the engine plugins this one externalizes
 * nothing but `@routier/core`, which is a peer dependency and must not be bundled in
 * (two copies of core in one process means `instanceof` fails across the boundary, which is
 * why the codebase uses type-guard helpers rather than `instanceof` for cross-package checks).
 */
export default defineConfig({
    entry: "./src/index.ts",
    output: {
        path: resolve(__dirname, "dist"),
        filename: "index.js",
        library: {
            type: "commonjs2"
        },
        globalObject: "this",
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    // Rspack ships this loader with its native binding. Using ts-loader here
                    // unnecessarily requires webpack itself to be installed as a peer and makes
                    // an otherwise-Rspack-only package fail to build in a clean workspace.
                    loader: "builtin:swc-loader",
                    options: {
                        jsc: {
                            parser: { syntax: "typescript" },
                            target: "es2022",
                        },
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    externals: {
        "@routier/core": "commonjs @routier/core",
        "@routier/core/schema": "commonjs @routier/core/schema",
        "@routier/core/expressions": "commonjs @routier/core/expressions",
        "@routier/core/plugins": "commonjs @routier/core/plugins",
    },
    target: "web",
    mode: "development",
    devtool: "source-map"
});
