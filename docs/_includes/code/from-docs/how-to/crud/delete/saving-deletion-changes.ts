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

// Saving deletion changes
const users = await ctx.users.where(u => u.age < 18).toArrayAsync();
console.log(`Found ${users.length} users to delete`);

// Mark users for deletion
await ctx.users.removeAsync(...users);
console.log("Users marked for deletion");

// Save all deletion changes
await ctx.saveChangesAsync();
console.log("Deletion changes saved successfully");

// Verify deletion
const remainingUsers = await ctx.users.where(u => u.age < 18).countAsync();
console.log(`Remaining users under 18: ${remainingUsers}`);
