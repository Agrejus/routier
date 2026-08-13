const schema = s.define("users", {
  // Direct values
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  count: s.number().default(0),

  // Function values (evaluated when needed)
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().default(() => new Date()),

  // Complex defaults with functions
  tags: s.array(s.string()).default(() => []),
  settings: s
    .object({
      theme: s.string().default("light"),
      language: s.string().default("en"),
    })
    .default(() => ({ theme: "light", language: "en" })),

  // Dynamic defaults based on injected context
  userId: s.string().default((injected) => injected.currentUserId),
});