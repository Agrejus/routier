import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// TypeScript type safety example
type CreateUser = InferCreateType<typeof userSchema>;

function createUserSafely(userData: CreateUser) {
    // TypeScript ensures userData has correct structure
    return ctx.users.addAsync(userData);
}

// ✅ TypeScript will catch these errors at compile time:
// createUserSafely({ name: "John" }); // Error: Missing required field 'email'
// createUserSafely({ name: "John", email: "john@example.com", age: "thirty" }); // Error: Wrong type for age

// ✅ This will work - TypeScript ensures type safety
const user = await createUserSafely({
    name: "John Doe",
    email: "john@example.com",
    age: 30
});

console.log("Created user:", user);

await ctx.saveChangesAsync();
