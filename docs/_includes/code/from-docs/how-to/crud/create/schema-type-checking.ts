import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s, InferCreateType } from "@routier/core/schema";

// Define a user schema with distinct constraint
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(), // Creates database index for uniqueness
    name: s.string(),
}).compile();

// Create DataStore with collection
class AppContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("app-db"));
    }

    users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// TypeScript will catch type mismatches at compile time
type CreateUser = InferCreateType<typeof userSchema>;

// ✅ Valid - TypeScript ensures correct types
const validUser: CreateUser = {
    email: "user@example.com",
    name: "John Doe"
};

// ❌ Invalid - TypeScript will show error
// const invalidUser: CreateUser = {
//   email: 123,        // Error: Type 'number' is not assignable to type 'string'
//   name: "John Doe"
// };

// Note: Routier does not enforce unique constraints at runtime
// The .distinct() modifier only creates database indexes
// Duplicate emails will be allowed in memory and may cause issues at database level
const duplicateUser = await ctx.users.addAsync({
    email: "user@example.com", // This will be allowed even if another user has this email
    name: "Jane Doe"
});

await ctx.saveChangesAsync();
