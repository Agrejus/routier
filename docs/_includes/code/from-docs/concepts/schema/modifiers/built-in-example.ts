import { s } from "@routier/core/schema";

// Built-in modifiers examples within schemas
const bestPracticeSchema = s.define("bestPractice", {
    id: s.string().key().identity(),

    // Use built-in modifiers instead of custom logic
    email: s.string().distinct(), // Instead of custom uniqueness validation
    createdAt: s.date().default(() => new Date()), // Instead of manual timestamp setting
    isActive: s.boolean().default(true), // Instead of conditional logic

    // Define constraints early
    status: s.string("pending", "approved", "rejected").default("pending"),
    priority: s.number(1, 2, 3, 4, 5).default(1),
}).compile();
