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

// Large dataset deletion - delete in chunks to avoid memory issues
async function deleteLargeDataset() {
    const batchSize = 1000;
    let totalDeleted = 0;

    while (true) {
        // Get a batch of users to delete
        const usersToDelete = await ctx.users
            .where(u => u.createdAt < new Date("2020-01-01"))
            .take(batchSize)
            .toArrayAsync();

        if (usersToDelete.length === 0) {
            break; // No more users to delete
        }

        // Delete the batch
        await ctx.users.removeAsync(...usersToDelete);
        await ctx.saveChangesAsync();

        totalDeleted += usersToDelete.length;
        console.log(`Deleted ${usersToDelete.length} users. Total: ${totalDeleted}`);

        // Optional: Add a small delay to prevent overwhelming the system
        // await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Large dataset deletion completed. Total deleted: ${totalDeleted}`);
}

// Alternative: Use query-based deletion for large datasets (most efficient)
async function deleteLargeDatasetEfficient() {
    const countBefore = await ctx.users.countAsync();
    console.log(`Users before deletion: ${countBefore}`);

    // Single query-based deletion (most efficient)
    await ctx.users.where(u => u.createdAt < new Date("2020-01-01")).removeAsync();
    await ctx.saveChangesAsync();

    const countAfter = await ctx.users.countAsync();
    console.log(`Users after deletion: ${countAfter}`);
    console.log(`Deleted: ${countBefore - countAfter} users`);
}

// Usage
await deleteLargeDatasetEfficient();
