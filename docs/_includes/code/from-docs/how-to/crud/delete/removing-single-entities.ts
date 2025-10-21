import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    isActive: s.boolean().default(true),
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

// Removing single entities
const user = await ctx.users.firstAsync();
console.log("User to remove:", user);

// Remove the entity by reference
const removedUser = await ctx.users.removeAsync(user);
console.log("Removed user:", removedUser);

// Save changes to persist the deletion
await ctx.saveChangesAsync();
console.log("Deletion persisted");
