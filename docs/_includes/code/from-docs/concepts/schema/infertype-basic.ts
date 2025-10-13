import { InferType, InferCreateType, s } from "@routier/core/schema";

// Define a schema
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
}).compile();

// Extract the TypeScript type
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// User type includes all properties (including defaults and identities)
const user: User = {
    id: "user-123",           // Required (identity)
    email: "john@example.com", // Required
    name: "John Doe",         // Required
    age: 30,                  // Optional
    createdAt: new Date(),    // Required (has default)
};

// CreateUser type excludes defaults and identities
const newUser: CreateUser = {
    email: "jane@example.com", // Required
    name: "Jane Doe",          // Required
    age: 25,                   // Optional
    // id and createdAt are optional (auto-generated/defaulted)
};
