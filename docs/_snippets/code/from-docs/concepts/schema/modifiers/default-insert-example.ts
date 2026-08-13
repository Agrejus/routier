import { s } from "@routier/core/schema";

// Default values with insert semantics
const userSchema = s.define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),

    // Properties with defaults are optional during inserts
    createdAt: s.date().default(() => new Date()),
    isActive: s.boolean().default(true),
    role: s.string("user", "admin").default("user"),
}).compile();

// Usage example - these properties can be omitted during creation
const newUser = {
    name: "John Doe",
    email: "john@example.com",
    // createdAt, isActive, and role will use their defaults
};
