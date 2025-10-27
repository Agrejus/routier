import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }
}