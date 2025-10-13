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

// Checking for changes
const user = await ctx.users.firstAsync();

// Check if there are any pending changes
const hasChanges = ctx.hasChanges();
console.log("Has changes:", hasChanges); // false

// Make some changes
user.name = "Updated Name";
user.email = "updated@example.com";

// Check again
const hasChangesAfter = ctx.hasChanges();
console.log("Has changes after update:", hasChangesAfter); // true

// Save changes
await ctx.saveChangesAsync();

// Check after save
const hasChangesAfterSave = ctx.hasChanges();
console.log("Has changes after save:", hasChangesAfterSave); // false
