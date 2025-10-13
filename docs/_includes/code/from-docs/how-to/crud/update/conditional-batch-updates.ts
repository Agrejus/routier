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

// Conditional batch updates
const users = await ctx.users.toArrayAsync();

// Apply conditional updates
users.forEach(user => {
    if (user.age >= 18) {
        user.isActive = true;
    }

    if (user.email.includes("admin")) {
        user.name = `Admin: ${user.name}`;
    }

    if (user.createdAt < new Date("2023-01-01")) {
        user.name = `Legacy: ${user.name}`;
    }
});

console.log("Conditionally updated users:", users);

// Save all changes
await ctx.saveChangesAsync();
