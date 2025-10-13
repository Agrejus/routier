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

// Handle empty results gracefully
async function getUserByEmail(email: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.email === email);

    if (!user) {
        console.log(`No user found with email: ${email}`);
        return null;
    }

    return user;
}

async function getActiveUsers() {
    const users = await ctx.users.where(u => u.age >= 18).toArrayAsync();

    if (users.length === 0) {
        console.log("No active users found");
        return [];
    }

    console.log(`Found ${users.length} active users`);
    return users;
}

async function getUserCount() {
    const count = await ctx.users.countAsync();

    if (count === 0) {
        console.log("No users in the database");
        return 0;
    }

    console.log(`Total users: ${count}`);
    return count;
}

// Usage with proper error handling
try {
    const user = await getUserByEmail("nonexistent@example.com");
    const activeUsers = await getActiveUsers();
    const totalCount = await getUserCount();
} catch (error) {
    console.error("Query failed:", error);
}
