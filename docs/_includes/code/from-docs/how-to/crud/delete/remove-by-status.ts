import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    status: s.string("active", "inactive", "pending", "suspended").default("pending"),
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

// Remove by status - batch deletion based on status
await ctx.users.where(u => u.status === "suspended").removeAsync();
console.log("Removed all suspended users");

await ctx.users.where(u => u.status === "inactive").removeAsync();
console.log("Removed all inactive users");

// Remove users with specific statuses
await ctx.users.where(u => u.status === "pending" && u.createdAt < new Date("2023-01-01")).removeAsync();
console.log("Removed old pending users");

// Save all changes
await ctx.saveChangesAsync();
