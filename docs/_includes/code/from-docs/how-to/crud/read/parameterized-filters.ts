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

// Parameterized filters - more efficient for database queries
const minAge = 25;
const maxAge = 65;
const isActive = true;

// Using variables in filters (non-parameterized - less efficient)
const usersByAge = await ctx.users.where(u => u.age >= minAge && u.age <= maxAge).toArrayAsync();
console.log("Users by age range:", usersByAge);

// Parameterized filters (more efficient - translates to database queries)
const activeUsersInRange = await ctx.users.where((u, p) => u.age >= p.minAge && u.age <= p.maxAge && u.isActive === p.isActive, {
    minAge,
    maxAge,
    isActive
}).toArrayAsync();
console.log("Active users in range:", activeUsersInRange);
