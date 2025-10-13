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

// Complete pagination example
async function getUsersPage(pageNumber: number, pageSize: number) {
    const skipAmount = (pageNumber - 1) * pageSize;

    const users = await ctx.users
        .where(u => u.age >= 18) // Filter active users
        .sort(u => u.name) // Sort by name
        .skip(skipAmount)
        .take(pageSize)
        .toArrayAsync();

    return users;
}

// Get total count for pagination info
const totalUsers = await ctx.users.where(u => u.age >= 18).countAsync();
const totalPages = Math.ceil(totalUsers / 10);

console.log(`Total users: ${totalUsers}, Total pages: ${totalPages}`);

// Get first page
const firstPage = await getUsersPage(1, 10);
console.log("First page:", firstPage);

// Get second page
const secondPage = await getUsersPage(2, 10);
console.log("Second page:", secondPage);
