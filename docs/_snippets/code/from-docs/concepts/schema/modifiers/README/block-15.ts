// Good - logical order
email: s.string().distinct().optional().default("user@example.com");

// Avoid - confusing order
email: s.string().default("user@example.com").distinct().optional();