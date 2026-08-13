const schema = s.define("users", {
  // Identity and keys
  id: s.string().key().identity(),
  email: s.string().identity(),

  // Optional and nullable
  middleName: s.string().optional(),
  avatar: s.string().nullable(),

  // Default values (can be direct values or functions)
  status: s.string().default("active"),
  isEnabled: s.boolean().default(true),
  createdAt: s.date().default(() => new Date()),

  // Readonly properties
  id: s.string().key().identity().readonly(),

  // Indexed fields
  name: s.string().index(),
  category: s.string().index("cat_status"),
  status: s.string().index("cat_status"), // Compound index
});