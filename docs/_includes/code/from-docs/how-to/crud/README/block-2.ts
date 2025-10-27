import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "routier-plugin-memory";
import { s } from "routier-core/schema";

// Define your schemas
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().optional(),
  })
  .compile();

// Create your DataStore class
class AppContext extends DataStore {
  constructor() {
    // Pass a plugin to the super constructor
    super(new MemoryPlugin("my-app"));
  }

  // Create collections from schemas
  users = this.collection(userSchema).create();
}