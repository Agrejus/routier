import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    role: s.string("admin", "user", "guest").default("user"),
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

// Business logic type checking
type User = InferType<typeof userSchema>;

async function promoteUser(userId: string) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        throw new Error("User not found");
    }

    // Business logic validation
    if (user.age < 18) {
        throw new Error("Cannot promote users under 18");
    }

    if (user.role === "admin") {
        throw new Error("User is already an admin");
    }

    // Type-safe update
    user.role = "admin"; // TypeScript ensures this is a valid role

    await ctx.saveChangesAsync();
    return user;
}

// Usage with business logic
try {
    const promotedUser = await promoteUser("user-123");
    console.log("User promoted:", promotedUser);
} catch (error) {
    console.error("Promotion failed:", error.message);
}
