import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryConfig } from "../scripts/rspack.library.mjs";

export default libraryConfig({
    dirname: dirname(fileURLToPath(import.meta.url)),
    target: "web",
});
