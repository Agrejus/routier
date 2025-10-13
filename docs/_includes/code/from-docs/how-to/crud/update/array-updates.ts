import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema with arrays
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    tags: s.array(s.string()).default([]),
    scores: s.array(s.number()).default([]),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Array updates
const user = await ctx.users.firstAsync();

// Update array properties
user.tags = ["developer", "javascript", "typescript"];
user.scores = [85, 92, 78, 96];

console.log("Updated user with arrays:", user);

// Modify existing arrays
user.tags.push("react");
user.scores.push(88);

console.log("Added to arrays:", user);

// Save changes
await ctx.saveChangesAsync();
