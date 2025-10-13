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

// Simple filters
const activeUsers = await ctx.users.where(u => u.isActive === true).toArrayAsync();
console.log("Active users:", activeUsers);

const usersOver25 = await ctx.users.where(u => u.age > 25).toArrayAsync();
console.log("Users over 25:", usersOver25);

const specificUser = await ctx.users.where(u => u.email === "john@example.com").firstOrUndefinedAsync();
console.log("Specific user:", specificUser);
