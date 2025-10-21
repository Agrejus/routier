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

// Remove by query - remove entities matching specific criteria
await ctx.users.where(u => u.age < 18).removeAsync();
console.log("Removed all users under 18");

// Remove inactive users
await ctx.users.where(u => u.isActive === false).removeAsync();
console.log("Removed all inactive users");

// Remove users created before a certain date
const cutoffDate = new Date("2023-01-01");
await ctx.users.where(u => u.createdAt < cutoffDate).removeAsync();
console.log("Removed users created before 2023");

// Save all changes
await ctx.saveChangesAsync();
