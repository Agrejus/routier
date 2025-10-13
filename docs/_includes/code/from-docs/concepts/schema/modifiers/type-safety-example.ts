import { s, InferType, InferCreateType } from "@routier/core/schema";

// Type safety examples within schemas
const typeSafeSchema = s.define("typeSafe", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    age: s.number().default(18),
}).compile();

// Leverage TypeScript type safety
type User = InferType<typeof typeSafeSchema>;
type CreateUser = InferCreateType<typeof typeSafeSchema>;

// Type-safe function parameters
function createUser(userData: CreateUser): User {
    // TypeScript will enforce correct types
    return userData as User;
}

// Type-safe API responses
function getUser(): User {
    return {
        id: "user-123",
        name: "John Doe",
        email: "john@example.com",
        age: 30,
    };
}
