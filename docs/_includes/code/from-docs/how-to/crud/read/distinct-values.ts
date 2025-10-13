import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    city: s.string(),
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

// Distinct values
const distinctCities = await ctx.users.distinctAsync();
console.log("All distinct users:", distinctCities);

// Note: Routier's distinctAsync() returns all distinct entities, not distinct values of a specific field
// To get distinct values of a specific field, you would need to:
// 1. Get all entities
// 2. Extract the field values
// 3. Use Set to get unique values

const allUsers = await ctx.users.toArrayAsync();
const distinctCityNames = [...new Set(allUsers.map(u => u.city))];
console.log("Distinct city names:", distinctCityNames);

const distinctAges = [...new Set(allUsers.map(u => u.age))];
console.log("Distinct ages:", distinctAges);
