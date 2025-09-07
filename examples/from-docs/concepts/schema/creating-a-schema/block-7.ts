// Good - logical order
email: s.string().email().min(5).max(100).unique().required().tracked();

// Avoid - confusing order
email: s.string().required().email().unique().max(100).min(5);