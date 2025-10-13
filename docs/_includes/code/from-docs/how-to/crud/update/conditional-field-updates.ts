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
    role: s.string("admin", "user", "guest").default("user"),
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

// Conditional field updates
const user = await ctx.users.firstAsync();

// Update fields based on conditions
if (user.age >= 18) {
    user.isActive = true;
}

if (user.email.includes("admin")) {
    user.role = "admin";
}

if (user.createdAt < new Date("2023-01-01")) {
    user.name = `Legacy: ${user.name}`;
}

// Only update if certain conditions are met
if (user.score && user.score > 100) {
    user.role = "premium";
}

console.log("Conditionally updated user:", user);

// Save changes
await ctx.saveChangesAsync();
