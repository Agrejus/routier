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

// Memory management - avoid loading unnecessary data
// ✅ Good - only load what you need
const userNames = await ctx.users.map(u => u.name).toArrayAsync();

// ✅ Good - use pagination for large datasets
const paginatedUsers = await ctx.users
    .sort(u => u.createdAt)
    .skip(0)
    .take(100)
    .toArrayAsync();

// ❌ Avoid loading all data when you only need a subset
const allUsers = await ctx.users.toArrayAsync();
const first100 = allUsers.slice(0, 100);

// Efficient querying patterns
// ✅ Good - chain operations efficiently
const efficientQuery = await ctx.users
    .where(u => u.age >= 18)
    .sort(u => u.name)
    .take(10)
    .toArrayAsync();

// ✅ Good - use appropriate terminal methods
const count = await ctx.users.where(u => u.age >= 18).countAsync();
const exists = await ctx.users.someAsync(u => u.email === "admin@example.com");
