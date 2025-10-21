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

// Batch deletion for better performance
const usersToDelete = await ctx.users.where(u => u.age < 18).toArrayAsync();
console.log(`Found ${usersToDelete.length} users to delete`);

// ✅ Good - batch deletion (more efficient)
await ctx.users.removeAsync(...usersToDelete);
await ctx.saveChangesAsync();
console.log("Batch deletion completed");

// ❌ Less efficient - individual deletions
// for (const user of usersToDelete) {
//   await ctx.users.removeAsync(user);
//   await ctx.saveChangesAsync();
// }

// Query-based batch deletion (most efficient)
await ctx.users.where(u => u.createdAt < new Date("2023-01-01")).removeAsync();
await ctx.saveChangesAsync();
console.log("Query-based batch deletion completed");
