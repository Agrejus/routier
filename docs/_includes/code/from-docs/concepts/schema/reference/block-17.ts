// Read-only properties
s.string().readonly()

// Change tracking
s.string().tracked()

// Computed properties
s.string().computed((entity) => string)

// Function properties
s.function().computed((entity) => function)