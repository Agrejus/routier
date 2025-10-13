import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    profile: s.object({
        bio: s.string().optional(),
        avatar: s.string().optional(),
    }).optional(),
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

// Memory-efficient creation patterns
async function createUserEfficiently(userData: InferCreateType<typeof userSchema>) {
    // Create user with minimal memory footprint
    const user = await ctx.users.addAsync(userData);

    // Access properties directly (no copying)
    console.log("User ID:", user[0].id);
    console.log("User name:", user[0].name);

    return user[0];
}

// Avoid creating unnecessary intermediate objects
const userData: InferCreateType<typeof userSchema> = {
    name: "John Doe",
    email: "john@example.com"
    // profile is optional - don't create empty object
};

const user = await createUserEfficiently(userData);

// Direct property access is memory efficient
user.name = "John Updated"; // Direct modification, no copying

await ctx.saveChangesAsync();
