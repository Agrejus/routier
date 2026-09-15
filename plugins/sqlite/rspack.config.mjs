import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../../scripts/rspack.library.mjs";

export default libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    // `node`, even though one of the entries is the browser build. The target only decides
    // how Rspack resolves what it bundles, and every engine here is external, so nothing
    // Node-specific reaches the browser bundle. The browser entry imports no Node built-in.
    target: "node",
    // Not a peer dependency — every upstream release is prerelease-tagged, so no semver range
    // matches one — but still the consumer's to install, and never ours to bundle: inlined, its
    // loader looks for `sqlite3.wasm` next to our worker instead of next to its own module.
    externals: ["@sqlite.org/sqlite-wasm"],
    entry: {
        index: "./src/index.ts",
        "index.browser": "./src/index.browser.ts",
        "drivers/sqlite3": "./src/drivers/sqlite3.ts",
        "drivers/turso": "./src/drivers/turso.ts",
        // A plugin variant, not a driver — D1 has no interactive transaction for a driver
        // interface to sit on. Its own entry so a Workers bundle never pulls in node:sqlite.
        d1: "./src/d1.ts",
        // At the root of dist/, not under drivers/. The worker URL is resolved relative to
        // whichever file contains the expression, and that file is `index.browser.js` at the
        // root — the wasm driver is bundled into it rather than published separately, so that
        // there is exactly one depth to be correct about.
        wasmWorker: "./src/drivers/wasmWorker.ts",
    },
});
