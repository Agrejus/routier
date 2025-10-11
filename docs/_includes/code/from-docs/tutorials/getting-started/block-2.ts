import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";

// Define a schema
const userSchema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string().index(),
    email: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// Create a custom context class that extends DataStore
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  // Create collections from schemas
  users = this.collection(userSchema).create();
}

// Use the context
const ctx = new AppContext();

// Add data to the collection
await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Save changes
await ctx.saveChangesAsync();