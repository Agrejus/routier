import { DataStore } from "routier";
import { MemoryPlugin } from "routier-plugin-memory";

class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  users = this.collection(userSchema).create();
}