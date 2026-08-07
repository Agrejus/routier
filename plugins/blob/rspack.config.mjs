import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../../scripts/rspack.library.mjs";

export default libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    entry: {
        index: "./src/index.ts",
        // Its own entry point: the filesystem store is the only part that needs Node, and a
        // browser bundle must be able to leave it out entirely.
        "stores/fileSystem": "./src/stores/fileSystem.ts",
    },
});
