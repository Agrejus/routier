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

// Change batching - group related changes together
const user1 = await ctx.users.firstAsync();
const user2 = await ctx.users.skip(1).firstAsync();

// Make changes to multiple entities
user1.name = "Updated User 1";
user1.email = "user1@example.com";

user2.name = "Updated User 2";
user2.email = "user2@example.com";

// All changes are batched and saved together
await ctx.saveChangesAsync();
console.log("All changes batched and saved");

// This is more efficient than:
// await ctx.saveChangesAsync(); // after user1 changes
// await ctx.saveChangesAsync(); // after user2 changes
