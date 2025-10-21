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

// Safe deletion with comprehensive error handling
async function safeDeleteUser(userId: string) {
    try {
        // First, check if user exists
        const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        console.log(`Deleting user: ${user.name} (${user.email})`);

        // Perform the deletion
        await ctx.users.removeAsync(user);
        await ctx.saveChangesAsync();

        console.log("User deleted successfully");
        return true;

    } catch (error) {
        console.error("Deletion failed:", error.message);

        // Handle different types of errors
        if (error.message.includes("not found")) {
            console.error("User not found - check user ID");
        } else if (error.message.includes("network")) {
            console.error("Network error - retry later");
        } else if (error.message.includes("database")) {
            console.error("Database error - check connection");
        } else {
            console.error("Unexpected error:", error);
        }

        return false;
    }
}

// Usage with error handling
const success = await safeDeleteUser("user-123");
if (success) {
    console.log("Deletion completed successfully");
} else {
    console.log("Deletion failed - check logs for details");
}
