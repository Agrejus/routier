import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema with computed properties
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
    email: s.string().distinct(),
    age: s.number(),
}).modify(w => ({
    // Computed property that updates when firstName or lastName changes
    fullName: w.computed((entity) => `${entity.firstName} ${entity.lastName}`).tracked(),
})).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Computed updates - computed properties update automatically
const user = await ctx.users.firstAsync();

console.log("Before update:", user.fullName); // "John Doe"

// Update the underlying properties
user.firstName = "Jane";
user.lastName = "Smith";

console.log("After update:", user.fullName); // "Jane Smith" - automatically computed

// Save changes
await ctx.saveChangesAsync();
