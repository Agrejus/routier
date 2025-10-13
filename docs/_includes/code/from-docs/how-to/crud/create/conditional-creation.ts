import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
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

// Conditional creation based on business logic
async function createUserIfNotExists(userData: InferCreateType<typeof userSchema>) {
    // Check if user already exists
    const existingUser = await ctx.users.firstOrUndefinedAsync(u => u.email === userData.email);

    if (existingUser) {
        console.log("User already exists:", existingUser);
        return existingUser;
    }

    // Create new user
    const newUser = await ctx.users.addAsync(userData);
    console.log("Created new user:", newUser);
    return newUser;
}

// Usage
const user = await createUserIfNotExists({
    name: "John Doe",
    email: "john@example.com"
});

await ctx.saveChangesAsync();
