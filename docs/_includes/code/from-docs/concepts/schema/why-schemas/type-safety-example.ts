import { s, InferType } from "@routier/core/schema";

// Type safety example - schemas provide compile-time type checking
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
}).compile();

// TypeScript automatically infers the correct types
type User = InferType<typeof userSchema>;
// User = { id: string; name: string; email: string; age: number; }

// Type-safe function parameters
function processUser(user: User): string {
    return `${user.name} (${user.email})`;
}

// Compile-time type checking prevents errors
// processUser({ name: "John" }); // ❌ TypeScript error - missing required fields
// processUser({ name: "John", email: "john@example.com", age: "thirty" }); // ❌ TypeScript error - wrong type
