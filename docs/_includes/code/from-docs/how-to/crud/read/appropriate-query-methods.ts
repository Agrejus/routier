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

// Use appropriate query methods
async function getUserByEmail(email: string) {
    // ✅ Good - use firstOrUndefinedAsync when expecting 0 or 1 result
    return await ctx.users.firstOrUndefinedAsync(u => u.email === email);
}

async function checkUserExists(email: string) {
    // ✅ Good - use someAsync for existence checks
    return await ctx.users.someAsync(u => u.email === email);
}

async function getActiveUsersCount() {
    // ✅ Good - use countAsync when you only need the count
    return await ctx.users.where(u => u.age >= 18).countAsync();
}

async function getAllUserNames() {
    // ✅ Good - use map to select only needed fields
    return await ctx.users.map(u => u.name).toArrayAsync();
}

// Usage examples
const user = await getUserByEmail("john@example.com");
const exists = await checkUserExists("jane@example.com");
const count = await getActiveUsersCount();
const names = await getAllUserNames();
