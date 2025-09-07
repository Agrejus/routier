// Let TypeScript do the work
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// Use inferred types everywhere
function createUser(data: CreateUser): Promise<User> { ... }