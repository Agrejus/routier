import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

const userSchema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string(),
  })
  .compile();

// Perfect for unit tests
class TestContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("test"));
  }

  users = this.collection(userSchema).create();
}