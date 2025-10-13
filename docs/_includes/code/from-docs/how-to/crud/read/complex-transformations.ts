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

// Complex transformations with multiple operations
const userAnalytics = await ctx.users
    .where(u => u.age >= 18)
    .sort(u => u.createdAt)
    .map(u => ({
        id: u.id,
        name: u.name,
        age: u.age,
        email: u.email,
        ageGroup: u.age < 30 ? "young" : u.age < 50 ? "middle" : "senior",
        yearsSinceCreated: Math.floor((Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365))
    }))
    .toArrayAsync();
console.log("User analytics:", userAnalytics);

// Complex transformation with pagination
const paginatedUserSummaries = await ctx.users
    .where(u => u.age >= 18)
    .sortDescending(u => u.createdAt)
    .skip(0)
    .take(5)
    .map(u => ({
        name: u.name,
        email: u.email,
        age: u.age,
        createdAt: u.createdAt.toISOString()
    }))
    .toArrayAsync();
console.log("Paginated user summaries:", paginatedUserSummaries);
