import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema with appropriate defaults
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    role: s.string("admin", "user", "guest").default("user"), // Sensible default
    isActive: s.boolean().default(true), // Sensible default
    lastLogin: s.date().optional(), // No default - let it be undefined
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

// Use appropriate default values
async function createUserWithDefaults(userData: InferCreateType<typeof userSchema>) {
    // Only provide required fields - defaults handle the rest
    const user = await ctx.users.addAsync({
        name: userData.name,
        email: userData.email
        // role defaults to "user"
        // isActive defaults to true
        // createdAt defaults to current date
        // lastLogin remains undefined (optional)
    });

    console.log("User created with defaults:", user);
    return user;
}

// Usage
const user = await createUserWithDefaults({
    name: "Jane Doe",
    email: "jane@example.com"
});

await ctx.saveChangesAsync();
