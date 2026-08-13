// Good - define constraints at schema level
age: s.number().default(18);

// Avoid - constraints defined elsewhere
age: s.number(); // Constraints defined elsewhere