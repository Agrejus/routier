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

// Removing multiple entities
const users = await ctx.users.where(u => u.age < 18).toArrayAsync();
console.log("Users to remove:", users);

// Remove multiple entities by reference
const removedUsers = await ctx.users.removeAsync(...users);
console.log("Removed users:", removedUsers);

// Save changes to persist the deletions
await ctx.saveChangesAsync();
console.log("Deletions persisted");
