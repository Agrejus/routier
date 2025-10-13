import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
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

// Use meaningful update patterns
const user = await ctx.users.firstAsync();

// ✅ Good - meaningful update patterns
function updateUserProfile(user: any, profileData: { name: string; email: string }) {
    user.name = profileData.name;
    user.email = profileData.email;
}

function incrementUserScore(user: any, points: number) {
    user.score += points;

    // Level up logic
    if (user.score >= 100) {
        user.level += 1;
        user.score = 0; // Reset score
    }
}

function activateUser(user: any) {
    user.isActive = true;
}

// Usage
updateUserProfile(user, { name: "John Doe", email: "john@example.com" });
incrementUserScore(user, 25);
activateUser(user);

// Save all changes
await ctx.saveChangesAsync();

// ❌ Avoid - meaningless direct assignments without context
// user.name = "John";
// user.email = "john@example.com";
// user.score = 100;
