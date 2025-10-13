import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema with constraints
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(), // Unique constraint
    age: s.number(18, 19, 20, 21), // Literal constraint
    role: s.string("admin", "user", "guest").default("user"),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Constraint enforcement is handled by plugins, not Routier core
// Different plugins may behave differently:

// Memory plugin - allows duplicates and invalid values
const user1 = await ctx.users.addAsync({
    email: "test@example.com",
    age: 25, // Not in allowed literals (18,19,20,21) but will be allowed
});

const user2 = await ctx.users.addAsync({
    email: "test@example.com", // Duplicate email - will be allowed in memory
    age: 18, // Valid literal
});

console.log("Both users created:", user1, user2);

// Note: 
// - SQLite plugins may enforce unique constraints at database level
// - Memory plugins allow duplicates in memory
// - Check your specific plugin's documentation for constraint behavior

await ctx.saveChangesAsync();
