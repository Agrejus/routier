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

// Use appropriate deletion methods
async function demonstrateDeletionMethods() {
    // ✅ Good - Remove specific entities by reference
    const user = await ctx.users.firstAsync();
    await ctx.users.removeAsync(user);
    console.log("Removed user by reference");

    // ✅ Good - Remove multiple entities by reference
    const users = await ctx.users.where(u => u.age < 18).toArrayAsync();
    await ctx.users.removeAsync(...users);
    console.log("Removed multiple users by reference");

    // ✅ Good - Query-based removal (most efficient for large datasets)
    await ctx.users.where(u => u.createdAt < new Date("2023-01-01")).removeAsync();
    console.log("Removed users by query");

    // ✅ Good - Remove all entities
    await ctx.users.removeAllAsync();
    console.log("Removed all users");

    // Save all changes
    await ctx.saveChangesAsync();
}

// Choose the right method based on your needs:
// - removeAsync(entity) - for specific entities
// - removeAsync(...entities) - for multiple specific entities  
// - where().removeAsync() - for query-based removal
// - removeAllAsync() - for removing all entities

await demonstrateDeletionMethods();
