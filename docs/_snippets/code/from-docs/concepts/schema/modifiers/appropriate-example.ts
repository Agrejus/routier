import { s } from "@routier/core/schema";

// Appropriate modifiers examples within schemas
const appropriateSchema = s.define("appropriate", {
    id: s.string().key().identity(),

    // Use appropriate modifiers for the use case
    email: s.string().distinct(), // For unique email addresses
    username: s.string().distinct().index("username_idx"), // For searchable usernames
    createdAt: s.date().default(() => new Date()).readonly(), // For audit timestamps
    isActive: s.boolean().default(true), // For status flags
    metadata: s.object({}).optional().serialize(obj => JSON.stringify(obj)), // For flexible data

    // Avoid over-engineering
    // Don't use .distinct() on every field
    // Don't use .readonly() unless you need immutability
    // Don't use .serialize() unless you need custom format
}).compile();
