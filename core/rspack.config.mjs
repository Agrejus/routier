import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspack/cli";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    entry: {
        index: "./src/index.ts",
        "utilities/index": "./src/utilities/index.ts",
        "results/index": "./src/results/index.ts",
        "schema/index": "./src/schema/index.ts",
        "pipeline/index": "./src/pipeline/index.ts",
        "collections/index": "./src/collections/index.ts",
        "codegen/index": "./src/codegen/index.ts",
        "capabilities/index": "./src/capabilities/index.ts",
        "assertions/index": "./src/assertions/index.ts",
        "plugins/index": "./src/plugins/index.ts",
        "expressions/index": "./src/expressions/index.ts",
        "errors/index": "./src/errors/index.ts",
        "performance/index": "./src/performance/index.ts",
        "types/index": "./src/types/index.ts"
    },
    output: {
        path: resolve(__dirname, "dist"),
        filename: "[name].js",
        library: {
            type: "module"
        },
        globalObject: "this", // Ensures compatibility with both browser and Node.js
        clean: true, // Cleans the output directory before each build
    },
    experiments: {
        outputModule: true
    },
    module: {
        rules: [
            {
                test: /\.ts$/, // Match TypeScript files
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
                exclude: [
                    /node_modules/,
                    /\.test\.ts$/, // Exclude test files
                ],
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"], // Resolve TypeScript and JavaScript files
        fallback: {
            "perf_hooks": false
        }
    },
    target: "web", // Compile for both browser and Node.js
    externals: {
        // Define external dependencies to avoid bundling them
        // e.g., for lodash: "lodash": "lodash"
        "perf_hooks": "perf_hooks"
    },
    mode: "development", // Set production mode
    devtool: "source-map"
});
