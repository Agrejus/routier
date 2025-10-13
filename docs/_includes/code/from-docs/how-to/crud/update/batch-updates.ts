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

// Batch updates for better performance
const users = await ctx.users.where(u => u.age >= 18).toArrayAsync();

// Update multiple entities efficiently
users.forEach(user => {
    user.isActive = true;
    user.name = user.name.toUpperCase();
});

console.log(`Updated ${users.length} users`);

// Save all changes in one operation
await ctx.saveChangesAsync();
console.log("All changes saved efficiently");
