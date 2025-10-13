import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a user schema with nested objects
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    profile: s.object({
        firstName: s.string(),
        lastName: s.string(),
        bio: s.string().optional(),
        avatar: s.string().optional(),
    }),
    preferences: s.object({
        theme: s.string("light", "dark").default("light"),
        notifications: s.boolean().default(true),
    }).default({}),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Nested object updates
const user = await ctx.users.firstAsync();

// Update nested object properties
user.profile.firstName = "John";
user.profile.lastName = "Doe";
user.profile.bio = "Software developer";

// Update preferences
user.preferences.theme = "dark";
user.preferences.notifications = false;

console.log("Updated user with nested objects:", user);

// Save changes
await ctx.saveChangesAsync();
