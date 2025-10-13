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

// Single property updates
const user = await ctx.users.firstAsync();

// Update individual properties
user.name = "New Name";
console.log("Updated name:", user.name);

user.email = "newemail@example.com";
console.log("Updated email:", user.email);

user.age = 25;
console.log("Updated age:", user.age);

// Save changes
await ctx.saveChangesAsync();
