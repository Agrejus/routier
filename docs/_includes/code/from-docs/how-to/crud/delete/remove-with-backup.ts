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

// Remove with backup - create backup before deletion
async function removeUsersWithBackup(userIds: string[]) {
    // Create backup of users before deletion
    const usersToDelete = await ctx.users.where(u => userIds.includes(u.id)).toArrayAsync();

    if (usersToDelete.length === 0) {
        console.log("No users found to delete");
        return;
    }

    // Create backup (in a real app, you might save to a file or backup database)
    const backup = {
        timestamp: new Date().toISOString(),
        users: usersToDelete.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            age: user.age,
            isActive: user.isActive,
            createdAt: user.createdAt
        }))
    };

    console.log("Backup created:", backup);

    try {
        // Remove the users
        await ctx.users.removeAsync(...usersToDelete);
        await ctx.saveChangesAsync();
        console.log("Users deleted successfully");

        // In a real app, you might save the backup to a file
        // fs.writeFileSync(`backup-${Date.now()}.json`, JSON.stringify(backup, null, 2));

    } catch (error) {
        console.error("Failed to delete users:", error);
        console.log("Backup available for recovery:", backup);
    }
}

// Usage
await removeUsersWithBackup(["user-1", "user-2", "user-3"]);
