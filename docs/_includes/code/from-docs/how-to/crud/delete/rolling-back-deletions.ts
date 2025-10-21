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

// Rolling back deletions - Routier doesn't have built-in rollback
// But you can implement it by not calling saveChangesAsync()

const user = await ctx.users.firstAsync();
console.log("User before deletion:", user);

// Mark for deletion
await ctx.users.removeAsync(user);
console.log("User marked for deletion");

// Check if there are pending changes
const hasChanges = ctx.hasChanges();
console.log("Has pending changes:", hasChanges); // true

// Rollback by not saving changes
// In Routier, if you don't call saveChangesAsync(), changes are not persisted
console.log("Rolling back deletion by not saving changes");

// The user is still in memory but marked for deletion
// To truly rollback, you would need to implement your own mechanism
// or use a transaction-like pattern

// If you want to "rollback", you could:
// 1. Not call saveChangesAsync() (changes are lost on next operation)
// 2. Implement your own undo mechanism
// 3. Use soft deletion instead of hard deletion
