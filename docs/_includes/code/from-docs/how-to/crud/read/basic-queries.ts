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

// Getting all entities
const allUsers = await ctx.users.toArrayAsync();
console.log("All users:", allUsers);

// Getting single entity (first)
const firstUser = await ctx.users.firstAsync();
console.log("First user:", firstUser);

// Getting single entity or undefined
const userOrUndefined = await ctx.users.firstOrUndefinedAsync(u => u.age > 25);
console.log("User over 25:", userOrUndefined);
