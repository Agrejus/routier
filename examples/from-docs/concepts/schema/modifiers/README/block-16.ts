// Good - use built-in modifiers
s.string().distinct();
s.date().default(() => new Date());

// Avoid - custom validation when built-in exists
s.string().validate((email) => email.includes("@"));