import { s } from "@routier/core/schema";

// Nullable properties within schemas
const dataSchema = s.define("data", {
    id: s.string().key().identity(),
    name: s.string(),

    // Nullable properties (can be null)
    description: s.string().nullable(),
    metadata: s.object({}).nullable(),

    // Nullable with default
    status: s.string().nullable().default(null),

    // Both optional and nullable
    notes: s.string().optional().nullable(),
}).compile();
