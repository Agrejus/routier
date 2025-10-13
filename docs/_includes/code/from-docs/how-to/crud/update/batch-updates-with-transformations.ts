import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    score: s.number().default(0),
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

// Batch updates with transformations
const users = await ctx.users.toArrayAsync();

// Apply transformations to multiple users
users.forEach(user => {
    // Transform name to uppercase
    user.name = user.name.toUpperCase();

    // Calculate score based on age
    user.score = user.age * 10;

    // Add prefix to email
    user.email = `user_${user.email}`;
});

console.log("Transformed users:", users);

// Save all transformations
await ctx.saveChangesAsync();
