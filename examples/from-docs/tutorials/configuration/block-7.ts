import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

class AppContext extends DataStore {
  constructor() {
    // Pass primary plugin to super constructor
    super(new MemoryPlugin("my-app"));

    // Additional configuration can go here
  }
}