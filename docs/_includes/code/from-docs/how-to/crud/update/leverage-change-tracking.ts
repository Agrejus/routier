import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Leverage change tracking - no manual update methods needed
const user = await ctx.users.firstAsync();

// ✅ Good - direct property modification
user.name = "Updated Name";
user.email = "updated@example.com";
user.age = 30;

// ✅ Good - changes are automatically tracked
console.log("Changes tracked automatically");

// ✅ Good - save all changes at once
await ctx.saveChangesAsync();

// ❌ Avoid - manual update methods (don't exist in Routier)
// user.update({ name: "New Name" }); // This doesn't exist
// user.save(); // This doesn't exist
