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

// Chain operations efficiently
// ✅ Good - efficient chaining
const efficientQuery = await ctx.users
    .where(u => u.age >= 18)
    .sort(u => u.name)
    .take(10)
    .toArrayAsync();

// ✅ Good - use parameterized queries for better performance
const parameterizedQuery = await ctx.users
    .where((u, p) => u.age >= p.minAge && u.age <= p.maxAge, { minAge: 18, maxAge: 65 })
    .sort(u => u.createdAt)
    .toArrayAsync();

// ✅ Good - filter early, transform late
const optimizedQuery = await ctx.users
    .where(u => u.age >= 18) // Filter first
    .where(u => u.createdAt > new Date("2023-01-01")) // Additional filter
    .sort(u => u.name) // Sort
    .map(u => ({ name: u.name, email: u.email })) // Transform last
    .toArrayAsync();

// ❌ Less efficient - unnecessary operations
const lessEfficientQuery = await ctx.users
    .toArrayAsync() // Load all data first
    .then(users => users.filter(u => u.age >= 18)) // Filter in memory
    .then(users => users.slice(0, 10)); // Take in memory
