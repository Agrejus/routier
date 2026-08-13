// Good - specific types
email: s.string().distinct();
age: s.number().default(18);

// Avoid - generic types
email: s.any();
age: s.any();