// Primary key
s.string().key();

// Auto-generated identity
s.string().identity();
s.number().identity();
s.date().identity();

// Unique constraint
s.string().unique();
s.number().unique();