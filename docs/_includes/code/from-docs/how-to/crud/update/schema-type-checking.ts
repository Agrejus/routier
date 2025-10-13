import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferType } from "@routier/core/schema";

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

// Type-safe updates with TypeScript
type User = InferType<typeof userSchema>;

async function updateUser(userId: string, updates: Partial<User>) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        throw new Error("User not found");
    }

    // TypeScript ensures type safety for property assignments
    if (updates.name !== undefined) {
        user.name = updates.name; // TypeScript ensures this is a string
    }

    if (updates.email !== undefined) {
        user.email = updates.email; // TypeScript ensures this is a string
    }

    if (updates.age !== undefined) {
        user.age = updates.age; // TypeScript ensures this is a number
    }

    await ctx.saveChangesAsync();
    return user;
}

// Usage with type safety
await updateUser("user-123", {
    name: "John Doe",
    age: 30
    // email: 123 // TypeScript error: Type 'number' is not assignable to type 'string'
});
