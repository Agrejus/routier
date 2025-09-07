// Good - use .optional() for truly optional fields
middleName: s.string().optional();

// Avoid - using .nullable() when .optional() is more appropriate
middleName: s.string().nullable(); // Allows null but not undefined