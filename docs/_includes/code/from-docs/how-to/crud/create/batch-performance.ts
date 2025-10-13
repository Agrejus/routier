import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
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

// Batch creation for better performance
async function createUsersBatch(userDataList: InferCreateType<typeof userSchema>[]) {
    const startTime = performance.now();

    // Create all users in a single operation
    const createdUsers = await ctx.users.addAsync(...userDataList);

    const endTime = performance.now();
    console.log(`Created ${createdUsers.length} users in ${endTime - startTime}ms`);

    return createdUsers;
}

// Generate test data
const usersToCreate: InferCreateType<typeof userSchema>[] = Array.from({ length: 100 }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`
}));

// Batch create all users at once
const createdUsers = await createUsersBatch(usersToCreate);

// Save all changes in one operation
await ctx.saveChangesAsync();

console.log(`Total users created: ${createdUsers.length}`);
