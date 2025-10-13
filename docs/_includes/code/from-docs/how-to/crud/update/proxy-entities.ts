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

// Proxy entities - entities returned from queries are proxy objects
const user = await ctx.users.firstAsync();
console.log("User before update:", user);

// Direct property modification - changes are automatically tracked
user.name = "Updated Name";
user.email = "updated@example.com";
user.age = 30;

console.log("User after update:", user);
console.log("Changes tracked automatically");

// Save changes to persist updates
await ctx.saveChangesAsync();
