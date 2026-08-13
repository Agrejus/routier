// Without schemas - prone to errors
const user = {
  name: "John",
  age: "thirty", // Oops! Age should be a number
  email: "invalid-email", // Oops! Invalid email format
};

// With schemas - type-safe and validated
const userSchema = s.object({
  name: s.string(),
  age: s.number().min(0).max(120),
  email: s.string().email(),
});

// TypeScript knows the exact types
type User = InferType<typeof userSchema>;
// User = { name: string; age: number; email: string; }

// Type checking ensures data structure matches schema
const result = userSchema.validate(user);
if (!result.valid) {
  console.log("Type errors:", result.errors);
}