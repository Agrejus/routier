// Good - well-structured nested objects
profile: s.object({
  personal: s.object({
    firstName: s.string(),
    lastName: s.string(),
  }),
  contact: s.object({
    email: s.string().distinct(),
    phone: s.string().optional(),
  }),
});

// Avoid - flat structure with prefixes
firstName: s.string(),
lastName: s.string(),
email: s.string().distinct(),
phone: s.string().optional(),