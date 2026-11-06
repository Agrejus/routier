import { MemoryPlugin } from "@routier/memory-plugin";
import { run } from "./scenario";

await run(new MemoryPlugin("csp"));
