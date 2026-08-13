// Good - use built-in modifiers
email: s.string().distinct();
createdAt: s.date().default(() => new Date());

// Avoid - custom validation when built-in exists
email: s.string().validate((email) => email.includes("@"));