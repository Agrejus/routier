import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// Perfect for unit tests
class TestContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("test"));
  }
}