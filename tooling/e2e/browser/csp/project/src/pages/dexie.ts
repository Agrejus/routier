import "../../../build/routier.generated.js";
import { DexiePlugin } from "@routier/dexie-plugin";
import { run } from "./scenario";

await run(new DexiePlugin("routier_csp_check"));
