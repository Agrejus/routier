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

// Complex sorting - multiple criteria
// Note: Routier doesn't support multiple sort criteria in a single query
// You need to chain multiple sort operations or use database-specific features

// Sort by age first, then by name
const usersSortedByAgeThenName = await ctx.users
    .sort(u => u.age)
    .sort(u => u.name)
    .toArrayAsync();
console.log("Users sorted by age then name:", usersSortedByAgeThenName);

// Complex query with filtering and sorting
const complexSortedQuery = await ctx.users
    .where(u => u.age >= 18)
    .sortDescending(u => u.createdAt)
    .sort(u => u.name)
    .toArrayAsync();
console.log("Complex sorted query:", complexSortedQuery);
