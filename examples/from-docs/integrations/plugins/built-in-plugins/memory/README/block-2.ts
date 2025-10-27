import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
  })
  .compile();

class AppContext extends DataStore {
  users = this.collection(userSchema).create();

  constructor() {
    super(new MemoryPlugin("my-app"));
  }
}