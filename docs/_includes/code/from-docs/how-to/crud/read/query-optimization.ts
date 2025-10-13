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

// Query optimization - use parameterized queries for better performance
const minAge = 18;
const maxAge = 65;

// ✅ Good - parameterized query (more efficient)
const optimizedUsers = await ctx.users
    .where((u, p) => u.age >= p.minAge && u.age <= p.maxAge, { minAge, maxAge })
    .sort(u => u.name)
    .toArrayAsync();

// ❌ Less efficient - non-parameterized query with variables
const lessEfficientUsers = await ctx.users
    .where(u => u.age >= minAge && u.age <= maxAge)
    .sort(u => u.name)
    .toArrayAsync();

// Use appropriate query methods
// ✅ Good - use firstOrUndefinedAsync when you expect 0 or 1 result
const user = await ctx.users.firstOrUndefinedAsync(u => u.email === "john@example.com");

// ✅ Good - use countAsync when you only need the count
const userCount = await ctx.users.where(u => u.age >= 18).countAsync();

// ❌ Less efficient - loading all data when you only need count
const allUsers = await ctx.users.where(u => u.age >= 18).toArrayAsync();
const count = allUsers.length;
