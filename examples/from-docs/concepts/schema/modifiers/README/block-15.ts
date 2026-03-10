// Good - logical order
s.string().distinct().optional().default("user@example.com");

// Avoid - confusing order
s.string().default("user@example.com").distinct().optional();