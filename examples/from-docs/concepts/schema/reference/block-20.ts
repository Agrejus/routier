// Basic computed property
w.computed((entity) => value);

// Computed with type context
w.computed((entity, type) => value);

// Computed with tracking
w.computed((entity) => value).tracked();