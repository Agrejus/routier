import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
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

// Update related fields together
const user = await ctx.users.firstAsync();

// ✅ Good - update related fields together
user.firstName = "John";
user.lastName = "Doe";
user.email = "john.doe@example.com";

// ✅ Good - all related changes are tracked together
console.log("Related fields updated together");

// Save all related changes
await ctx.saveChangesAsync();

// ❌ Avoid - updating fields separately and saving multiple times
// user.firstName = "John";
// await ctx.saveChangesAsync();
// user.lastName = "Doe";
// await ctx.saveChangesAsync();
