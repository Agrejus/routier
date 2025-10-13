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

// Validate before updating
type User = InferType<typeof userSchema>;

async function updateUserSafely(userId: string, updates: Partial<User>) {
    const user = await ctx.users.firstOrUndefinedAsync(u => u.id === userId);

    if (!user) {
        throw new Error("User not found");
    }

    // Validate business rules before updating
    if (updates.age !== undefined && updates.age < 0) {
        throw new Error("Age cannot be negative");
    }

    if (updates.email !== undefined && !updates.email.includes("@")) {
        throw new Error("Invalid email format");
    }

    if (updates.role !== undefined && !["admin", "user", "guest"].includes(updates.role)) {
        throw new Error("Invalid role");
    }

    // Apply updates
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.age !== undefined) user.age = updates.age;
    if (updates.role !== undefined) user.role = updates.role;

    await ctx.saveChangesAsync();
    return user;
}

// Usage with validation
try {
    const updatedUser = await updateUserSafely("user-123", {
        name: "John Doe",
        age: 30,
        role: "admin"
    });
    console.log("User updated successfully:", updatedUser);
} catch (error) {
    console.error("Update failed:", error.message);
}
