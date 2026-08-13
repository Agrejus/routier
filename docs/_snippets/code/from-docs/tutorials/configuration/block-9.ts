import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

class TestContext extends DataStore {
  constructor() {
    // Use Memory plugin for tests (no persistence, fast)
    super(new MemoryPlugin("test-app"));
  }
}