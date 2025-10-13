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

// Partial saves - save changes incrementally
const user1 = await ctx.users.firstAsync();
const user2 = await ctx.users.skip(1).firstAsync();

// Update first user
user1.name = "Updated User 1";
user1.email = "user1@example.com";

// Save first user's changes
await ctx.saveChangesAsync();
console.log("First user saved");

// Update second user
user2.name = "Updated User 2";
user2.email = "user2@example.com";

// Save second user's changes
await ctx.saveChangesAsync();
console.log("Second user saved");

// Both users are now updated and persisted
