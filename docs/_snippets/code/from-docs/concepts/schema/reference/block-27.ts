const userSchema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});

type User = InferType<typeof userSchema>;
// User = { id: string; name: string; email: string; }