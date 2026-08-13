type CreateUser = InferCreateType<typeof userSchema>;
// CreateUser = { name: string; email: string; }