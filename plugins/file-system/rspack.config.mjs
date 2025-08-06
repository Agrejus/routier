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
            type: "commonjs2"
        },
        globalObject: "this", // Ensures compatibility with both browser and Node.js
        clean: true, // Cleans the output directory before each build
    },
    module: {
        rules: [
            {
                test: /\.ts$/, // Match TypeScript files
                use: {
                    loader: "ts-loader",
                    options: {
                        transpileOnly: false, // Ensure type-checking is performed
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"], // Resolve TypeScript and JavaScript files
        fallback: {
            "perf_hooks": false,
            "fs": false,
            "path": false
        }
    },
    target: "node", // Changed from "web" to "node" since this plugin uses Node.js APIs
    mode: "development", // Set production mode
    devtool: "source-map"
});
