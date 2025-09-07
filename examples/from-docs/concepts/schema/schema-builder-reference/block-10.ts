// Available on all types
s.string().index(); // Single field index
s.string().index("compound"); // Compound index
s.string().index("idx1", "idx2"); // Multiple indexes
s.number().index("priority");
s.date().index("created_at");
s.boolean().index("status");