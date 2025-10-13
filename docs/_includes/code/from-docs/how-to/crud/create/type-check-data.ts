import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().optional(),
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

// Type-check data before creation
function validateUserData(data: any): data is InferCreateType<typeof userSchema> {
    return (
        typeof data === 'object' &&
        typeof data.name === 'string' &&
        typeof data.email === 'string' &&
        (data.age === undefined || typeof data.age === 'number')
    );
}

async function createUserSafely(userData: any) {
    // Validate data structure before creation
    if (!validateUserData(userData)) {
        throw new Error("Invalid user data structure");
    }

    // TypeScript now knows userData is valid
    const user = await ctx.users.addAsync(userData);
    console.log("User created successfully:", user);
    return user;
}

// Usage
try {
    const user = await createUserSafely({
        name: "John Doe",
        email: "john@example.com",
        age: 30
    });

    await ctx.saveChangesAsync();
} catch (error) {
    console.error("Failed to create user:", error);
}
