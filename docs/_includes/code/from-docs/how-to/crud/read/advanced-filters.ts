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

// Advanced filters with complex conditions
const complexQuery = await ctx.users
    .where(u => u.isActive === true && u.age >= 18 && u.age <= 65)
    .where(u => u.name.includes("John") || u.email.includes("admin"))
    .toArrayAsync();
console.log("Complex query results:", complexQuery);

// Multiple where clauses (AND logic)
const multiFilterQuery = await ctx.users
    .where(u => u.isActive === true)
    .where(u => u.age > 25)
    .where(u => u.createdAt > new Date("2023-01-01"))
    .toArrayAsync();
console.log("Multi-filter query:", multiFilterQuery);
