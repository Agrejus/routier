// Good - use .optional() for truly optional fields
s.string().optional();

// Avoid - using .nullable() when .optional() is more appropriate
s.string().nullable(); // Allows null but not undefined