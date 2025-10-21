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

// Remove with confirmation - check before deleting
async function removeUsersWithConfirmation(userIds: string[]) {
    // First, get the users to confirm what will be deleted
    const usersToDelete = await ctx.users.where(u => userIds.includes(u.id)).toArrayAsync();

    if (usersToDelete.length === 0) {
        console.log("No users found to delete");
        return;
    }

    console.log(`Found ${usersToDelete.length} users to delete:`);
    usersToDelete.forEach(user => {
        console.log(`- ${user.name} (${user.email})`);
    });

    // In a real application, you would show a confirmation dialog
    const confirmed = true; // Simulate user confirmation

    if (confirmed) {
        // Remove the users
        await ctx.users.removeAsync(...usersToDelete);
        await ctx.saveChangesAsync();
        console.log("Users deleted successfully");
    } else {
        console.log("Deletion cancelled");
    }
}

// Usage
await removeUsersWithConfirmation(["user-1", "user-2", "user-3"]);
