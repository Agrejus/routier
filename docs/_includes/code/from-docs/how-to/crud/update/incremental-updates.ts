import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    score: s.number().default(0),
    level: s.number().default(1),
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

// Incremental updates
const user = await ctx.users.firstAsync();

// Increment numeric values
user.score += 10;
user.level += 1;

console.log("Incremented values:", { score: user.score, level: user.level });

// Decrement values
user.score -= 5;

console.log("Decremented score:", user.score);

// Save changes
await ctx.saveChangesAsync();
