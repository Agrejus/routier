import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "preact",
    },
    build: {
        sourcemap: true,
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
                production: resolve(__dirname, "src/production.ts"),
            },
            formats: ["es", "cjs"],
            fileName: (format, entryName) => `${entryName}.${format === "cjs" ? "cjs" : "js"}`,
        },
        rollupOptions: {
            external: [/^@routier\/core(\/.*)?$/, /^@routier\/datastore(\/.*)?$/],
        },
        outDir: "dist",
    },
});
