import { MemoryPlugin } from "@routier/memory-plugin";

const memoryPlugin = new MemoryPlugin(
  "my-app" // Database name (optional). Omit it to use the shared default database.
);