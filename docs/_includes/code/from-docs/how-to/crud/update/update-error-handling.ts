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

// Update error handling
async function updateUserSafely(userId: string, updates: { name?: string; email?: string; age?: number }) {
    try {
        const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        // Apply updates
        if (updates.name !== undefined) user.name = updates.name;
        if (updates.email !== undefined) user.email = updates.email;
        if (updates.age !== undefined) user.age = updates.age;

        // Save changes
        await ctx.saveChangesAsync();

        console.log("User updated successfully:", user);
        return user;

    } catch (error) {
        console.error("Update failed:", error.message);

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

        throw error; // Re-throw for caller to handle
    }
}

// Usage with error handling
try {
    const updatedUser = await updateUserSafely("user-123", {
        name: "John Doe",
        email: "john@example.com",
        age: 30
    });
} catch (error) {
    console.error("Failed to update user:", error.message);
}
