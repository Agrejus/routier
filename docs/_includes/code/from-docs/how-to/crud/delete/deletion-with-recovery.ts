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

// Deletion with recovery - implement recovery mechanism
async function deleteUserWithRecovery(userId: string) {
    // Create backup before deletion
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Create recovery data
    const recoveryData = {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
        createdAt: user.createdAt,
        deletedAt: new Date().toISOString()
    };

    console.log("Recovery data created:", recoveryData);

    try {
        // Perform deletion
        await ctx.users.removeAsync(user);
        await ctx.saveChangesAsync();

        console.log("User deleted successfully");

        // In a real app, you might save recovery data to a separate table or file
        // await ctx.deletedUsers.addAsync(recoveryData);

        return true;

    } catch (error) {
        console.error("Deletion failed:", error.message);
        console.log("Recovery data available:", recoveryData);

        // Recovery mechanism could restore the user from backup
        // await ctx.users.addAsync(recoveryData);

        return false;
    }
}

// Recovery function
async function recoverUser(recoveryData: any) {
    try {
        // Restore user from recovery data
        const recoveredUser = await ctx.users.addAsync({
            name: recoveryData.name,
            email: recoveryData.email,
            age: recoveryData.age,
            createdAt: new Date(recoveryData.createdAt)
        });

        await ctx.saveChangesAsync();
        console.log("User recovered successfully:", recoveredUser);
        return true;

    } catch (error) {
        console.error("Recovery failed:", error.message);
        return false;
    }
}

// Usage
const recoveryData = {
    id: "user-123",
    name: "John Doe",
    email: "john@example.com",
    age: 30,
    createdAt: "2023-01-01T00:00:00.000Z",
    deletedAt: "2023-12-01T00:00:00.000Z"
};

await recoverUser(recoveryData);
