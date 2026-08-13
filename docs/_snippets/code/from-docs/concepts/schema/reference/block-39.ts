// Good - use indexes for frequently queried fields
const schema = s.object({
  id: s.string().key().identity(),
  email: s.string().email().unique().index(),
  status: s.string().index(),
});

// Good - avoid unnecessary computed properties
// Only compute what you actually need