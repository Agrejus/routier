// Begin with basic type definitions
const simpleSchema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});

// Add complexity as needed
const complexSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(100).index(),
  email: s.string().email().unique().index(),
  profile: s.object({
    bio: s.string().max(500),
    avatar: s.string().url().optional(),
  }),
  preferences: s.object({
    theme: s.literal("light", "dark", "auto").default("auto"),
    notifications: s.boolean().default(true),
  }),
});