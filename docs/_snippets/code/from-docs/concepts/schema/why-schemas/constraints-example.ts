import { s } from "@routier/core/schema";

// Type safety and constraints example
const orderSchema = s.define("orders", {
    id: s.string().key().identity(),
    status: s.string("pending", "processing", "shipped", "delivered"), // Constrained to specific values
    priority: s.number(1, 2, 3, 4, 5).default(1), // Constrained to specific numbers
    customerId: s.string().distinct(), // Ensures uniqueness
    createdAt: s.date().default(() => new Date()),
}).compile();

// Schemas ensure data structure matches your defined types
// This prevents bugs and improves data quality:

// ✅ Valid data structure
const validOrder = {
    status: "pending", // Must be one of the allowed values
    priority: 3, // Must be 1-5
    customerId: "customer-123",
    // createdAt will be auto-generated
};

// ❌ Invalid data (TypeScript will catch these)
// const invalidOrder = {
//   status: "invalid", // Not in allowed values
//   priority: 10, // Not in allowed range
//   customerId: "customer-123", // Could be duplicate
// };
