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

// Counting entities
const totalUsers = await ctx.users.countAsync();
console.log("Total users:", totalUsers);

const activeUsersCount = await ctx.users.where(u => u.age >= 18).countAsync();
console.log("Active users count:", activeUsersCount);

// Count with complex filters
const recentUsersCount = await ctx.users
    .where(u => u.createdAt > new Date("2023-01-01"))
    .where(u => u.age >= 18)
    .countAsync();
console.log("Recent active users count:", recentUsersCount);
