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

// Saving changes
const user = await ctx.users.firstAsync();

// Make changes
user.name = "Updated Name";
user.email = "updated@example.com";
user.age = 30;

console.log("Changes made:", user);

// Save all tracked changes
await ctx.saveChangesAsync();
console.log("Changes saved successfully");

// Verify changes were persisted
const updatedUser = await ctx.users.firstAsync();
console.log("Persisted user:", updatedUser);
