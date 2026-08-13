const schema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});