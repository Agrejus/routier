const schema = s.define("users", {
  // Single field index
  name: s.string().index(),

  // Compound index
  category: s.string().index("cat_status"),
  status: s.string().index("cat_status"),

  // Multiple indexes
  email: s.string().index("email").index("email_status"),
  isActive: s.boolean().index("email_status"),
});