import { s, InferType, InferCreateType } from "@routier/core/schema";

// Leverage type inference for type safety
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number(),
    isActive: s.boolean().default(true),
}).compile();

// TypeScript automatically infers types
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// Use inferred types for type safety
function createUser(userData: CreateUser): User {
    // TypeScript ensures correct data structure
    return userData as User;
}

function updateUser(user: User, updates: Partial<User>): User {
    // TypeScript ensures type-safe updates
    // In Routier, you modify properties directly on the proxy object
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.age !== undefined) user.age = updates.age;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    return user;
}

// Type inference benefits:
// - Automatic type generation
// - Compile-time type checking
// - IntelliSense support
// - Refactoring safety
// - API consistency
