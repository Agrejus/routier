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

// Complex query examples with chaining
const recentActiveUsers = await ctx.users
    .where(u => u.age >= 18)
    .where(u => u.createdAt > new Date("2023-01-01"))
    .sort(u => u.name)
    .take(10)
    .toArrayAsync();
console.log("Recent active users:", recentActiveUsers);

// Complex query with multiple operations
const userReport = await ctx.users
    .where(u => u.age >= 18)
    .sortDescending(u => u.createdAt)
    .skip(0)
    .take(20)
    .map(u => ({
        name: u.name,
        email: u.email,
        age: u.age,
        isRecent: u.createdAt > new Date("2023-06-01")
    }))
    .toArrayAsync();
console.log("User report:", userReport);

// Query with aggregation
const totalActiveUsers = await ctx.users
    .where(u => u.age >= 18)
    .countAsync();
console.log("Total active users:", totalActiveUsers);
