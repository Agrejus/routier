import { s } from "@routier/core/schema";

// Performance optimization example
const analyticsSchema = s.define("analytics", {
    id: s.string().key().identity(),
    userId: s.string().index("user_analytics"), // Indexed for fast user queries
    eventType: s.string("click", "view", "purchase").index("event_type_idx"), // Indexed for fast event queries
    timestamp: s.date().index("timestamp_idx"), // Indexed for time-based queries
    metadata: s.object({
        page: s.string(),
        referrer: s.string().optional(),
    }).serialize(obj => JSON.stringify(obj)) // Efficient serialization
        .deserialize(str => JSON.parse(str)),
}).modify(w => ({
    // Computed properties for common calculations
    isRecent: w.computed((entity) =>
        Date.now() - entity.timestamp.getTime() < 24 * 60 * 60 * 1000,
        {}
    ).tracked(), // Tracked for fast reads
})).compile();

// Schemas enable automatic performance optimizations:
// - Database indexes for fast queries
// - Efficient serialization/deserialization
// - Computed properties cached for performance
// - Optimized data structures
// - Memory-efficient operations
// - Query optimization hints
