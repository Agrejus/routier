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

// Remove with complex criteria
await ctx.users
    .where(u => u.age >= 18)
    .where(u => u.age <= 65)
    .where(u => u.isActive === false)
    .removeAsync();
console.log("Removed inactive users between 18-65");

// Remove users with specific email patterns
await ctx.users
    .where(u => u.email.includes("temp"))
    .where(u => u.createdAt < new Date("2023-01-01"))
    .removeAsync();
console.log("Removed old temporary users");

// Remove users with complex conditions
await ctx.users
    .where(u => u.name.includes("Test") || u.name.includes("Demo"))
    .where(u => u.createdAt < new Date("2022-01-01"))
    .removeAsync();
console.log("Removed old test/demo users");

// Save all changes
await ctx.saveChangesAsync();
