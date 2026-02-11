// ✅ Good - reusable type alias
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// ❌ Avoid - repeating the type everywhere
function processUser(user: InferType<typeof userSchema>) { ... }