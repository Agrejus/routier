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
            type: "commonjs2" // Use CommonJS for Node.js compatibility with native modules
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
            "path": false,
            "fs": false,
            "os": false,
            "crypto": false,
            "stream": false,
            "util": false,
            "buffer": false,
            "events": false
        }
    },
    externals: {
        // Externalize sqlite3 (native Node.js module) - it will be required at runtime
        // In browser environments, this will fail gracefully or use an alternative implementation
        "sqlite3": "commonjs sqlite3"
    },
    target: "web", // Compile for both browser and Node.js
    mode: "development", // Set production mode
    devtool: "source-map"
});
