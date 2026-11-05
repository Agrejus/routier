import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../tooling/scripts/rspack.library.mjs";

const [esm] = libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    target: "node",
});

export default esm;
