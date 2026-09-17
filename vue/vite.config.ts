import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "@routier/vue",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "cjs" ? "index.cjs" : "index.js"),
        },
        rollupOptions: {
            external: ["vue", /^@routier\/core(\/.*)?$/],
        },
        outDir: "dist",
    },
});
