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

// Multiple property updates
const user = await ctx.users.firstAsync();

// Update multiple properties at once
user.name = "John Doe";
user.email = "john.doe@example.com";
user.age = 30;
user.isActive = true;

console.log("Updated user:", user);

// All changes are tracked and will be saved together
await ctx.saveChangesAsync();
