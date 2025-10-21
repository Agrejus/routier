import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema with soft deletion
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    isActive: s.boolean().default(true),
    isDeleted: s.boolean().default(false), // Soft deletion flag
    deletedAt: s.date().optional(), // When it was soft deleted
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

// Soft deletion - mark as deleted instead of removing
async function softDeleteUser(userId: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId && u.isDeleted === false);

    if (!user) {
        console.log("User not found or already deleted");
        return;
    }

    // Mark as deleted instead of removing
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.isActive = false;

    console.log("User soft deleted:", user);

    // Save changes
    await ctx.saveChangesAsync();
}

// Restore soft deleted user
async function restoreUser(userId: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId && u.isDeleted === true);

    if (!user) {
        console.log("User not found or not deleted");
        return;
    }

    // Restore the user
    user.isDeleted = false;
    user.deletedAt = undefined;
    user.isActive = true;

    console.log("User restored:", user);

    // Save changes
    await ctx.saveChangesAsync();
}

// Get only active users (excluding soft deleted)
async function getActiveUsers() {
    const activeUsers = await ctx.users.where(u => u.isDeleted === false).toArrayAsync();
    console.log("Active users:", activeUsers);
    return activeUsers;
}

// Usage
await softDeleteUser("user-123");
await getActiveUsers();
await restoreUser("user-123");
