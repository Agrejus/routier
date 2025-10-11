import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  users = this.collection(userSchema).create();
}