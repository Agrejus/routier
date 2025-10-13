import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema leveraging schema features
const userSchema = s.define("users", {
    id: s.string().key().identity(), // Auto-generated IDs
    email: s.string().distinct(), // Unique constraint with indexing
    name: s.string(),
    role: s.string("admin", "user", "guest").default("user"), // Literal constraints
    isActive: s.boolean().default(true), // Default values
    createdAt: s.date().default(() => new Date()), // Function defaults
    lastLogin: s.date().optional(), // Optional fields
}).modify(w => ({
    // Computed properties
    displayName: w.computed((entity) =>
        `${entity.name} (${entity.role})`
    ).tracked(),

    // Function methods
    isAdmin: w.function((entity) => entity.role === "admin"),
})).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Leverage schema features for powerful creation
async function createUserWithSchemaFeatures(userData: InferCreateType<typeof userSchema>) {
    // Schema handles:
    // - Auto-generated ID
    // - Default values (role, isActive, createdAt)
    // - Type checking
    // - Computed properties
    // - Function methods

    const user = await ctx.users.addAsync(userData);

    // Access computed and function properties
    const createdUser = user[0];
    console.log("Display name:", createdUser.displayName); // Computed
    console.log("Is admin:", createdUser.isAdmin()); // Function

    return createdUser;
}

// Usage
const user = await createUserWithSchemaFeatures({
    email: "admin@example.com",
    name: "Admin User"
    // role defaults to "user" (but we can override)
});

await ctx.saveChangesAsync();
