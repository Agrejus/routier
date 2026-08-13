const schema = s.define("users", {
  // Direct values - set once when schema is created
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  count: s.number().default(0),

  // Function values - evaluated each time default is needed
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().default(() => new Date()),

  // Complex defaults with functions
  tags: s.array(s.string()).default(() => []),
  metadata: s
    .object({
      version: s.string().default("1.0.0"),
      lastModified: s.date().default(() => new Date()),
    })
    .default(() => ({ version: "1.0.0", lastModified: new Date() })),

  // Context-dependent defaults using injected parameter
  userId: s.string().default((injected) => injected.currentUserId),
  tenantId: s.string().default((injected) => injected.tenantId),
});