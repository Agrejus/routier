// Good - validate at schema level
const schema = s.object({
  age: s.number().min(0).max(120),
  email: s.string().email().unique(),
});

// Avoid - validation in application code
// if (user.age < 0 || user.age > 120) { ... }