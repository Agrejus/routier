import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
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

// Confirm deletions for important data
async function confirmDeletion(userId: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        console.log("User not found");
        return false;
    }

    // Show confirmation details
    console.log("⚠️  CONFIRMATION REQUIRED ⚠️");
    console.log(`User: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Created: ${user.createdAt}`);

    // In a real application, you would show a confirmation dialog
    const confirmed = true; // Simulate user confirmation

    if (confirmed) {
        await ctx.users.removeAsync(user);
        await ctx.saveChangesAsync();
        console.log("✅ User deleted successfully");
        return true;
    } else {
        console.log("❌ Deletion cancelled");
        return false;
    }
}

// Usage
await confirmDeletion("user-123");
