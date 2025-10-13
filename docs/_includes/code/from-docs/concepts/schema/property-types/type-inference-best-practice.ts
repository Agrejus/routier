import { s, InferType, InferCreateType } from "@routier/core/schema";

// Leverage TypeScript type inference
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().default(18),
    isActive: s.boolean().default(true),
    tags: s.array(s.string()).default([]),
}).compile();

// TypeScript automatically infers the correct types
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// Use inferred types for type safety
function processUser(user: User): string {
    return `${user.name} (${user.email})`;
}

function createNewUser(userData: CreateUser): User {
    // TypeScript ensures all required fields are provided
    return userData as User;
}
