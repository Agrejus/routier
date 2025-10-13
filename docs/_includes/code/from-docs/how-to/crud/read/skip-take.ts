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

// Skip and take for pagination
const pageSize = 10;
const pageNumber = 1;
const skipAmount = (pageNumber - 1) * pageSize;

const paginatedUsers = await ctx.users
    .skip(skipAmount)
    .take(pageSize)
    .toArrayAsync();
console.log(`Page ${pageNumber} users:`, paginatedUsers);

// Get next page
const nextPageUsers = await ctx.users
    .skip(skipAmount + pageSize)
    .take(pageSize)
    .toArrayAsync();
console.log("Next page users:", nextPageUsers);
