import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
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

// Handle errors gracefully
async function createUserWithErrorHandling(userData: InferCreateType<typeof userSchema>) {
    try {
        const user = await ctx.users.addAsync(userData);
        console.log("User created successfully:", user);
        return user;
    } catch (error) {
        // Handle different types of errors
        if (error instanceof Error) {
            console.error("Error creating user:", error.message);

            // Handle specific error types
            if (error.message.includes("network")) {
                console.error("Network error occurred");
                // Handle network issues
            } else if (error.message.includes("database")) {
                console.error("Database error occurred");
                // Handle database issues
            } else {
                console.error("Unexpected error:", error);
                // Handle unexpected errors
            }
        }

        throw error; // Re-throw for caller to handle
    }
}

// Usage with error handling
try {
    const user = await createUserWithErrorHandling({
        name: "John Doe",
        email: "john@example.com"
    });

    await ctx.saveChangesAsync();
} catch (error) {
    console.error("Failed to create and save user:", error);
    // Handle the error appropriately (retry, show user message, etc.)
}
