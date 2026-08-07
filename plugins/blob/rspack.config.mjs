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
        // Also its own entry: the AWS SDK is optional and must not be pulled into the
        // main bundle by an application that never touches S3.
        "stores/s3": "./src/stores/s3.ts",
    },
});
