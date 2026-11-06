import { MemoryPlugin } from "@routier/memory-plugin";
import { run } from "./scenario";
import "../../../build/routier.generated.js";

await run(new MemoryPlugin("csp"));
