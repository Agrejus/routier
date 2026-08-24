import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../../scripts/rspack.library.mjs";

export default libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    target: "web",
    entry: {
        index: "./src/index.ts",
        "index.browser": "./src/index.browser.ts",
        // At the root of dist/, because the `new URL('./pgliteWorker.js', import.meta.url)`
        // expression is resolved relative to whichever file contains it — `index.browser.js`,
        // which is also at the root. One depth to be correct about.
        pgliteWorker: "./src/pgliteWorker.ts",
    },
});
