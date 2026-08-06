import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../scripts/rspack.library.mjs";

export default libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    target: "web",
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
});
