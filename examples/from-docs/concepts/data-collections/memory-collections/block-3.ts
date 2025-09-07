import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }

  cache = this.collection(cacheSchema).create();
}