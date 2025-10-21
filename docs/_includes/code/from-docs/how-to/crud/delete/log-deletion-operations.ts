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

// Log deletion operations
async function logDeletionOperation(userId: string, reason: string, performedBy: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Log the deletion operation
    const deletionLog = {
        timestamp: new Date().toISOString(),
        operation: "DELETE_USER",
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        reason: reason,
        performedBy: performedBy,
        userAge: user.age,
        userCreatedAt: user.createdAt
    };

    console.log("Deletion log:", deletionLog);

    // In a real application, you would save this to a log table or file
    // await ctx.deletionLogs.addAsync(deletionLog);

    // Perform the deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log("User deleted and operation logged");
    return true;
}

// Batch deletion with logging
async function logBatchDeletion(userIds: string[], reason: string, performedBy: string) {
    const users = await ctx.users.where(u => userIds.includes(u.id)).toArrayAsync();

    if (users.length === 0) {
        console.log("No users found to delete");
        return false;
    }

    // Log batch deletion
    const batchDeletionLog = {
        timestamp: new Date().toISOString(),
        operation: "BATCH_DELETE_USERS",
        userIds: users.map(u => u.id),
        userCount: users.length,
        reason: reason,
        performedBy: performedBy,
        users: users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            age: u.age,
            createdAt: u.createdAt
        }))
    };

    console.log("Batch deletion log:", batchDeletionLog);

    // Perform batch deletion
    await ctx.users.removeAsync(...users);
    await ctx.saveChangesAsync();

    console.log(`Batch deletion completed: ${users.length} users deleted`);
    return true;
}

// Usage
await logDeletionOperation("user-123", "Account closure requested", "admin");
await logBatchDeletion(["user-1", "user-2", "user-3"], "Cleanup of inactive accounts", "system");
