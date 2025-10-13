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

// Automatic change detection - no manual update calls needed
const user = await ctx.users.firstAsync();

// Modify properties directly - Routier automatically detects changes
user.name = "John Updated";
user.email = "john.updated@example.com";
user.age = 31;

// Changes are tracked automatically - no need to call update methods
console.log("User updated:", user);

// Save all tracked changes
await ctx.saveChangesAsync();
