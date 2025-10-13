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

// Basic sorting - ascending
const usersByNameAsc = await ctx.users.sort(u => u.name).toArrayAsync();
console.log("Users sorted by name (ascending):", usersByNameAsc);

// Basic sorting - descending
const usersByAgeDesc = await ctx.users.sortDescending(u => u.age).toArrayAsync();
console.log("Users sorted by age (descending):", usersByAgeDesc);

// Sorting with filtering
const activeUsersSorted = await ctx.users
    .where(u => u.age >= 18)
    .sort(u => u.createdAt)
    .toArrayAsync();
console.log("Active users sorted by creation date:", activeUsersSorted);
