import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspack/cli";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    entry: "./src/index.ts", // Entry point for your library
    output: {
        path: resolve(__dirname, "dist"),
        filename: "index.js", // Default output file name
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
                    /\.test\.ts$/, // Exclude test files,
                    /\.setup\.ts$/, // Exclude test files
                ],
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"], // Resolve TypeScript and JavaScript files
        fallback: {
            "perf_hooks": false
        },
        alias: {
            react: resolve(__dirname, 'node_modules/react'),
            'react-dom': resolve(__dirname, 'node_modules/react-dom')
        }
    },
    target: "web", // Compile for both browser and Node.js
    mode: "development", // Set production mode
    devtool: "source-map"
});
