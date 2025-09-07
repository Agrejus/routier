const schema = s.define("users", {
  // Basic boolean
  isActive: s.boolean(),

  // Boolean with literal constraints
  verified: s.boolean<true>(), // Only true allowed

  // Boolean with modifiers
  isEnabled: s.boolean().default(true),
  hasPermission: s.boolean().optional(),
});