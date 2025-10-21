import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    isActive: s.boolean().default(true),
    role: s.string("admin", "user", "guest").default("user"),
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

// Conditional deletion - delete based on business rules
async function conditionalDeleteUser(userId: string, reason: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Business rules for deletion
    if (user.role === "admin") {
        console.log("Cannot delete admin users");
        return false;
    }

    if (user.isActive && reason !== "inactive") {
        console.log("Cannot delete active users unless they are inactive");
        return false;
    }

    if (user.createdAt > new Date("2023-01-01") && reason === "old") {
        console.log("Cannot delete users created after 2023 with 'old' reason");
        return false;
    }

    // All conditions passed, proceed with deletion
    await ctx.users.removeAsync(user);
    await ctx.saveChangesAsync();

    console.log(`User ${user.name} deleted successfully. Reason: ${reason}`);
    return true;
}

// Usage
await conditionalDeleteUser("user-123", "inactive");
await conditionalDeleteUser("admin-456", "inactive"); // Will be blocked
await conditionalDeleteUser("new-user-789", "old"); // Will be blocked
