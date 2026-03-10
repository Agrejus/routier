// Good - define constraints at schema level
s.number().default(18);

// Avoid - constraints defined elsewhere
s.number(); // Constraints defined elsewhere