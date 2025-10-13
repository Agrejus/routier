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

// Mapping data - selecting specific fields
const userNames = await ctx.users.map(u => u.name).toArrayAsync();
console.log("User names:", userNames);

const userEmails = await ctx.users.map(u => u.email).toArrayAsync();
console.log("User emails:", userEmails);

// Mapping with computed fields
const userSummaries = await ctx.users.map(u => ({
    id: u.id,
    displayName: `${u.name} (${u.age})`,
    isAdult: u.age >= 18
})).toArrayAsync();
console.log("User summaries:", userSummaries);

// Mapping with filtering
const adultUserNames = await ctx.users
    .where(u => u.age >= 18)
    .map(u => u.name)
    .toArrayAsync();
console.log("Adult user names:", adultUserNames);
