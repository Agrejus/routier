// ❌ Cannot use .key() with .optional() (keys are always required)
s.string().key().optional(); // Error

// ❌ Cannot use .identity() with .default() (identity generates values)
s.string().identity().default("value"); // Error

// ✅ Can use .optional() with .nullable()
s.string().optional().nullable(); // Valid

// ✅ Can use .distinct() with .index()
s.string().distinct().index(); // Valid